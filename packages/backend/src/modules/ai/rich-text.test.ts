import { cleanRichText, toPlainText, unfence } from './rich-text';

describe('cleanRichText', () => {
  it('keeps allowed tags and drops their attributes', () => {
    expect(cleanRichText('<p class="x" onclick="y">A <strong style="color:red">b</strong></p>')).toBe('<p>A <strong>b</strong></p>');
  });

  it('renames tags the editor stores differently', () => {
    expect(cleanRichText('<b>x</b><i>y</i><h1>T</h1><h4>S</h4><div>D</div><br/>')).toBe('<strong>x</strong><em>y</em><h2>T</h2><h3>S</h3><p>D</p><br>');
  });

  it('drops scripts, styles, frames and images with their content', () => {
    expect(cleanRichText('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><img src="x" onerror="y"><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('keeps safe links only', () => {
    expect(cleanRichText(`<a href="https://x.cz" target="_blank">ok</a> <a href="javascript:alert(1)">bad</a> <a href='mailto:a@b.cz'>m</a> <a data-href="https://x.cz">no</a>`)).toBe(
      '<a href="https://x.cz">ok</a> bad <a href="mailto:a@b.cz">m</a> no',
    );
  });

  it('keeps the text of unknown tags', () => {
    expect(cleanRichText('<span>x</span><section>y</section>')).toBe('xy');
  });

  it('attribute values with > and quotes', () => {
    expect(cleanRichText(`<a href="https://x.cz/?q=a>b" title='x>y'>link</a>`)).toBe('<a href="https://x.cz/?q=a>b">link</a>');
  });

  it('escapes a stray < so no tag can start from it', () => {
    expect(cleanRichText('<p>1 < 2</p><img src=x onerror=alert(1)')).toBe('<p>1 &lt; 2</p>&lt;img src=x onerror=alert(1)');
  });

  it('comments and unclosed blocks', () => {
    expect(cleanRichText('<p>a<!-- <script>x</script> --></p>')).toBe('<p>a</p>');
    expect(cleanRichText('<p>a</p><script>alert(1)')).toBe('<p>a</p>');
  });

  it('removes a Markdown code fence around the answer', () => {
    expect(cleanRichText('```html\n<p>a</p>\n```')).toBe('<p>a</p>');
  });
});

describe('toPlainText', () => {
  it('strips tags and leaves out script text', () => {
    expect(toPlainText('<p>We <b>were</b> there.</p><script>x</script>')).toBe('We were there.');
  });

  it('puts blocks on their own lines', () => {
    expect(toPlainText('<p>a</p><p>b</p>')).toBe('a\nb');
  });

  it('decodes entities once and keeps a plain <', () => {
    expect(toPlainText('Fish &amp; chips &amp;lt;')).toBe('Fish & chips &lt;');
    expect(toPlainText('1 < 2')).toBe('1 < 2');
  });

  it('removes a code fence', () => {
    expect(toPlainText('```\n<b>We</b> were there.\n```')).toBe('We were there.');
  });
});

describe('unfence', () => {
  it('leaves text without a fence alone', () => {
    expect(unfence('plain')).toBe('plain');
  });
});
