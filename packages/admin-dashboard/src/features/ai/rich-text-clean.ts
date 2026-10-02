const KEEP = new Set(['P', 'H2', 'H3', 'STRONG', 'EM', 'U', 'S', 'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR'])
const RENAME: Record<string, string> = { B: 'STRONG', I: 'EM', H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P', STRIKE: 'S', DEL: 'S' }
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META'])
const SAFE_HREF = /^(https?:|mailto:)/i

/** Models sometimes wrap the answer in a Markdown code fence. */
function unfence(text: string): string {
  const fenced = /^\s*```[a-z]*\s*\n([\s\S]*?)\n?```\s*$/i.exec(text)
  return (fenced ? fenced[1] : text).trim()
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (text: string) => escape(text).replace(/"/g, '&quot;')

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escape(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  if (DROP.has(el.tagName)) return ''
  const inner = Array.from(el.childNodes).map(walk).join('')
  const tag = RENAME[el.tagName] ?? el.tagName
  if (!KEEP.has(tag)) return inner
  const name = tag.toLowerCase()
  if (tag === 'BR') return '<br>'
  if (tag === 'A') {
    const href = el.getAttribute('href')?.trim() ?? ''
    return SAFE_HREF.test(href) ? `<a href="${escapeAttr(href)}">${inner}</a>` : `<a>${inner}</a>`
  }
  return `<${name}>${inner}</${name}>`
}

/** The AI's HTML reduced to the tags the rich-text editor keeps; no attributes except safe link targets. */
export function cleanRichText(html: string): string {
  const doc = new DOMParser().parseFromString(unfence(html), 'text/html')
  return Array.from(doc.body.childNodes).map(walk).join('').trim()
}

/** Text without any markup, for plain text fields. */
export function toPlainText(text: string): string {
  const doc = new DOMParser().parseFromString(unfence(text), 'text/html')
  // Script and style contents are code, not text.
  doc.body.querySelectorAll([...DROP].join(',')).forEach((el) => el.remove())
  return (doc.body.textContent ?? '').trim()
}
