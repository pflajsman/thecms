import { cleanRichText, toPlainText } from './rich-text-clean'

it('keeps the editor tags and safe links, and drops everything else', () => {
  expect(cleanRichText('<h2>Šumava</h2><p>Byli jsme <strong>tam</strong> a <a href="https://x.test" onclick="alert(1)">zpět</a>.</p>')).toBe(
    '<h2>Šumava</h2><p>Byli jsme <strong>tam</strong> a <a href="https://x.test">zpět</a>.</p>',
  )
  expect(cleanRichText('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>')).toBe('<p>a</p>')
  expect(cleanRichText('<p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>')).toBe('<p><a>x</a></p>')
  expect(cleanRichText('<div><b>tučně</b> <i>kurzíva</i></div><h1>Nadpis</h1>')).toBe('<p><strong>tučně</strong> <em>kurzíva</em></p><h2>Nadpis</h2>')
})

it('removes a Markdown code fence around the answer', () => {
  expect(cleanRichText('```html\n<p>Ahoj</p>\n```')).toBe('<p>Ahoj</p>')
  expect(toPlainText('```\nAhoj\n```')).toBe('Ahoj')
})

it('turns any HTML into plain text for text fields', () => {
  expect(toPlainText('<p>Byli jsme <strong>tam</strong>.</p>')).toBe('Byli jsme tam.')
  expect(toPlainText('  Jen text  ')).toBe('Jen text')
})

it('leaves out script and style text when making plain text', () => {
  expect(toPlainText('Druhý <strong>odstavec</strong>.<script>alert(1)</script><style>p{color:red}</style>')).toBe('Druhý odstavec.')
})
