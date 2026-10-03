import test from 'node:test';
import assert from 'node:assert/strict';
import { alignedOffset, headingKeys, moveItem, noteTarget, exportNotes } from '../web/review-model.js';

test('headings match by normalized text and occurrence', () => {
  assert.deepEqual(headingKeys([{ text: '# Same  title' }, { text: 'same title' }]).map(item => item.key), ['same title:0', 'same title:1']);
  assert.equal(alignedOffset(200, [{ text: 'Shared', top: 200 }], [{ text: 'shared', top: 500 }], 1000, 1500), 500);
  assert.equal(alignedOffset(600, [{ text: 'Shared', top: 200 }], [{ text: 'shared', top: 500 }], 1000, 1500), 1000);
  assert.equal(alignedOffset(200, [], [], 1000, 2000), 400);
});

test('ordered references move without mutating input and respect ends', () => {
  const items = ['first', 'second', 'third'];
  assert.deepEqual(moveItem(items, 1, -1), ['second', 'first', 'third']);
  assert.deepEqual(moveItem(items, 2, 1), items);
  assert.deepEqual(items, ['first', 'second', 'third']);
});

test('notes use heading then snippet then offset and retain orphans', () => {
  const anchor = { path: 'synthetic.md', heading: 'shared', snippet: 'passage', offset: 90 };
  const candidates = [{ id: 'shared', text: 'Heading', top: 10 }, { id: '', text: 'A passage', top: 40 }];
  assert.deepEqual(noteTarget(anchor, candidates), { offset: 10, orphan: false, fallback: 'heading' });
  assert.equal(noteTarget(anchor, candidates.slice(1)).offset, 40);
  assert.deepEqual(noteTarget(anchor, []), { offset: 90, orphan: true, fallback: 'offset' });
  assert.equal(noteTarget(anchor, candidates, false).orphan, true);
  assert.equal(exportNotes([{ anchor, text: '<script>\n**not markup**' }]).includes('\\<script\\>'), true);
  assert.equal(exportNotes([]), '');
});
