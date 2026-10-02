import { RICH_TEXT_TAGS } from './prompts';

/**
 * Cleans AI output on the server, where nobody previews it before it is saved.
 * Without an HTML parser dependency it works on tags only: every tag outside the
 * allowed list is dropped, and any `<` that does not start a kept tag is escaped.
 */

const KEEP = new Set(RICH_TEXT_TAGS);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3', div: 'p' };
const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'textarea', 'select', 'head', 'title'];
const SAFE_HREF = /^(https?:|mailto:)/i;
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const TAG = new RegExp(`<(\\/?)([a-zA-Z][\\w-]*)(${ATTRS})>`, 'g');
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const FENCE = /^\s*```[\w-]*[ \t]*\n([\s\S]*?)\n?[ \t]*```\s*$/;
const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&amp;': '&' };

export function unfence(text: string): string {
  return FENCE.exec(text)?.[1] ?? text;
}

function dropBlocks(html: string): string {
  let out = html.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  for (const tag of DROP_WITH_CONTENT) {
    out = out.replace(new RegExp(`<${tag}\\b${ATTRS}>[\\s\\S]*?(?:<\\/${tag}\\s*>|$)`, 'gi'), '');
  }
  return out;
}

const escapeText = (text: string) => text.replace(/</g, '&lt;');

export function cleanRichText(raw: string): string {
  const html = dropBlocks(unfence(raw));
  const links: boolean[] = [];
  let out = '';
  let last = 0;
  for (const m of html.matchAll(TAG)) {
    out += escapeText(html.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const closing = m[1] === '/';
    const lower = m[2].toLowerCase();
    const name = RENAME[lower] ?? lower;
    if (!KEEP.has(name)) continue;
    if (name === 'a') {
      if (closing) {
        if (links.pop()) out += '</a>';
        continue;
      }
      const found = HREF.exec(m[3]);
      const href = found ? (found[1] ?? found[2] ?? found[3]).trim() : '';
      const safe = SAFE_HREF.test(href);
      links.push(safe);
      if (safe) out += `<a href="${href.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">`;
      continue;
    }
    if (name === 'br') {
      if (!closing) out += '<br>';
      continue;
    }
    out += closing ? `</${name}>` : `<${name}>`;
  }
  return (out + escapeText(html.slice(last))).trim();
}

export function toPlainText(raw: string): string {
  const text = dropBlocks(unfence(raw))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote)\s*>/gi, '\n')
    .replace(TAG, '')
    .replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (entity) => ENTITIES[entity]);
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
