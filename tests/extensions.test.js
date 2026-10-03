import test from 'node:test';
import assert from 'node:assert/strict';
import { frontMatter, prepareMarkdown } from '../web/extensions.js';
import { reference } from '../web/actions.js';

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
