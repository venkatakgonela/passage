import test from 'node:test';
import assert from 'node:assert/strict';
import { frontMatter, prepareMarkdown } from '../web/extensions.js';
import { reference } from '../web/actions.js';
import { readFileSync, readdirSync } from 'node:fs';

test('currency stays literal while delimited math and protected code work', () => {
  for (const currency of ['Costs $5 and $10 per month', '$1,200 or $1,500', 'cash $ and $ cash', 'US$20 and $30', '$ x$', '$x $', '$x$2']) {
    const result = prepareMarkdown(currency);
    assert.equal(result.math.length, 0, currency);
    assert.equal(result.body, currency);
  }
  const mixed = prepareMarkdown('Costs $5; math $x^2$ and $E=mc^2$, also ($a+b$).');
  assert.deepEqual(mixed.math.map(item => item.source), ['x^2', 'E=mc^2', 'a+b']);
  assert.ok(mixed.body.includes('Costs $5;'));
  assert.equal(prepareMarkdown('`$5 and $x$`\n```text\n$x$\n```').math.length, 0);
  assert.deepEqual(prepareMarkdown('$$5 + 10$$').math, [{ source: '5 + 10', display: true }]);
});

test('web code never invokes native alert or confirmation dialogs', () => {
  for (const name of readdirSync(new URL('../web/', import.meta.url)).filter(name => /\.(js|html|css)$/.test(name))) {
    assert.doesNotMatch(readFileSync(new URL('../web/' + name, import.meta.url), 'utf8'), /\b(?:alert|confirm)\s*\(/, name);
  }
});

test('metadata is bounded, literal and removed from body', () => {
  const result = frontMatter('---\ntitle: <script>bad</script>\n---\n# Synthetic');
  assert.equal(result.text, '# Synthetic');
  assert.equal(result.fields[0][1], '<script>bad</script>');
  assert.equal(frontMatter('---\n' + 'a'.repeat(17000) + '\n---').fields.length, 0);
});
test('math recognizes inline/display but preserves fenced and inline code', () => {
  const result = prepareMarkdown('Inline $x^2$\n\n$$y=2$$\n\n`$code$`\n```txt\n$raw$\n```');
  assert.deepEqual(result.math, [{ source: 'x^2', display: false }, { source: 'y=2', display: true }]);
  assert.match(result.body, /\$code\$/);
  assert.match(result.body, /\$raw\$/);
  assert.equal(prepareMarkdown('no math').math.length, 0);
  assert.equal(prepareMarkdown('$x$ '.repeat(201)).math.length, 200);
});
test('footnote content escaped, repeated references return separately', () => {
  const result = prepareMarkdown('Example[^one] again[^one]\n\n[^one]: <img src=x onerror=bad()>', 'pane-');
  assert.match(result.notes, /&lt;img/);
  assert.match(result.notes, /pane-ref-one-2/);
  assert.match(result.body, /pane-note-one/);
});
test('copy reference preserves passage and encodes destination', () => {
  assert.match(reference('file name.md', 'a b', 'hello\nworld'), /file%20name.md#a%20b/);
  assert.match(reference('file.md', '', 'hello\nworld'), /> hello\n> world/);
});
