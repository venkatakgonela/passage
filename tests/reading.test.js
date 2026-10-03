import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, DEFAULTS } from '../web/appearance.js';
import { validateDiagram } from '../web/diagrams.js';
import { documentHash } from '../web/paths.js';
import { readFileSync } from 'node:fs';

test('appearance values are bounded and defaults are predictable', () => {
  assert.deepEqual(normalizeAppearance(DEFAULTS), DEFAULTS);
  const values = normalizeAppearance({ theme: 'unsafe', fs: 200, measure: 0, font: 'unknown', focus: 'true' });
  assert.equal(values.fs, 24);
  assert.equal(values.measure, 60);
  assert.equal(values.theme, 'auto');
  assert.equal(values.focus, false);
  assert.equal(normalizeAppearance({}).measure, 80);
  assert.equal(normalizeAppearance({ measure: 68 }).measure, 68);
  assert.equal(normalizeAppearance({ measure: 140 }).measure, 140);
  assert.equal(normalizeAppearance({ measure: 200 }).measure, 140);
  assert.equal(normalizeAppearance({ fill: true }).fill, true);
  assert.equal(normalizeAppearance({ fill: 'true' }).fill, false);
});

test('diagram source rejects configuration and unbounded input', () => {
  assert.doesNotThrow(() => validateDiagram('flowchart LR\nDraft --> Review'));
  for (const source of ['%%{init: {}}%%\nflowchart LR', '---\nconfig: unsafe', 'flowchart LR\nclick node "https://example.invalid"', 'flowchart LR\n' + 'x'.repeat(50001), 'pie\n"A": 1']) assert.throws(() => validateDiagram(source));
});

test('native document and heading fragments are encoded separately', () => {
  assert.equal(documentHash('notes/detail.md', 'a heading'), '#notes%2Fdetail.md#a%20heading');
});

test('diagram fixture labels are accepted as data', () => {
  const markdown = readFileSync(new URL('../examples/architecture.md', import.meta.url), 'utf8');
  const diagrams = [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(match => match[1]);
  assert.equal(diagrams.length, 5);
  for (const source of diagrams) assert.doesNotThrow(() => validateDiagram(source));
});

test('ER cardinality preserves later policy statements and attribute blocks', () => {
  for (const relationship of ['A ||--o{ B : x', 'A }o--|| B : x', 'A |{--}| B : x']) {
    const source = `erDiagram\n${relationship}\nA {\n string name\n}`;
    assert.doesNotThrow(() => validateDiagram(source));
    for (const directive of ['style A fill:red', 'classDef x fill:red']) {
      assert.throws(() => validateDiagram(`erDiagram\n${relationship}\n${directive}`), /not allowed/);
      assert.throws(() => validateDiagram(`${source}\n${directive}`), /not allowed/);
    }
  }
});

test('unterminated quotes and brackets cannot hide directives', () => {
  for (const source of ['flowchart LR\nA[unclosed\nstyle A fill:red', 'flowchart LR\nA["unclosed\nclick A "x', 'erDiagram\nA {\n string name']) assert.throws(() => validateDiagram(source), /Unterminated/);
});

test('diagram statements distinguish directives from labels and node names', () => {
  for (const source of [
    'flowchart LR\nclickWorker --> styleWorker',
    'flowchart LR\nclick --> style',
    'sequenceDiagram\nclickClient->>styleServer: Click to submit',
    'flowchart LR\nA["style A red; click A x\nclassDef note"] --> B',
    'flowchart LR\nA[Build container image] --> B[Code style checks]',
    'flowchart LR\nA["href http://example.test data: text"]',
    'flowchart LR\n%% click A x\nA --> B',
  ]) assert.doesNotThrow(() => validateDiagram(source), source);
  for (const statement of [
    'click A "x"', 'A-->B; click A "x"',
    '  style A fill:red', '  classDef warning fill:red',
    'A-->B; style A fill:red', 'click A href "http://example.test"',
    'link A: notes @ http://example.test', 'links A: {"notes":"http://example.test"}',
    'linkStyle 0 stroke:red', 'A@{ img: "http://example.test/image.png" }',
    '%%{init: {securityLevel: "loose"}}%%',
  ]) assert.throws(() => validateDiagram(`flowchart LR\n${statement}`), /not allowed/, statement);
  assert.throws(() => validateDiagram(' \n---\nconfig: unsafe\n---\nflowchart LR'), /not allowed/);
  assert.throws(() => validateDiagram('sequenceDiagram\nClient->>Server: submit; link Client: notes @ http://example.test'), /not allowed/);
});

test('diagram character and line limits retain exact boundaries', () => {
  const prefix = 'flowchart LR\n';
  assert.doesNotThrow(() => validateDiagram(prefix + 'x'.repeat(50000 - prefix.length)));
  assert.throws(() => validateDiagram(prefix + 'x'.repeat(50001 - prefix.length)), /limit/);
  assert.doesNotThrow(() => validateDiagram('flowchart LR' + '\n'.repeat(499)));
  assert.throws(() => validateDiagram('flowchart LR' + '\n'.repeat(500)), /limit/);
  assert.throws(() => validateDiagram('pie\n"A": 1'), /Supported diagrams/);
});
