import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, DEFAULTS } from '../web/appearance.js';
import { validateDiagram } from '../web/diagrams.js';
import { documentHash } from '../web/paths.js';

test('appearance values are bounded and defaults are predictable', () => {
  assert.deepEqual(normalizeAppearance(DEFAULTS), DEFAULTS);
  const values = normalizeAppearance({ theme: 'unsafe', fs: 200, measure: 0, font: 'unknown', focus: 'true' });
  assert.equal(values.fs, 24);
  assert.equal(values.measure, 65);
  assert.equal(values.theme, 'auto');
  assert.equal(values.focus, false);
});

test('diagram source rejects configuration and unbounded input', () => {
  assert.doesNotThrow(() => validateDiagram('flowchart LR\nDraft --> Review'));
  for (const source of ['%%{init: {}}%%\nflowchart LR', '---\nconfig: unsafe', 'flowchart LR\nclick node "https://example.invalid"', 'flowchart LR\n' + 'x'.repeat(50001), 'pie\n"A": 1']) assert.throws(() => validateDiagram(source));
});

test('native document and heading fragments are encoded separately', () => {
  assert.equal(documentHash('notes/detail.md', 'a heading'), '#notes%2Fdetail.md#a%20heading');
});
