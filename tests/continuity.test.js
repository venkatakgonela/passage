import test from 'node:test';
import assert from 'node:assert/strict';
import { sortEntries, filterEntries, fuzzyEntries, validateSession, appendVisit, restoreTarget } from '../web/continuity-model.js';

test('natural sorting and modified direction', () => {
  const entries = [{ path: 'T10.md', modified: 1 }, { path: 'T2.md', modified: 2 }];
  assert.equal(sortEntries(entries)[0].path, 'T2.md');
  assert.equal(sortEntries(entries, { descending: true })[0].path, 'T10.md');
  assert.equal(sortEntries(entries, { sort: 'modified', descending: true })[0].path, 'T2.md');
});
test('filter preserves descendant paths for ancestor reconstruction', () => {
  assert.deepEqual(filterEntries([{ path: 'folder/deep/file.md', title: 'Needle' }, { path: 'other.md', title: 'Other' }], 'needle').map(item => item.path), ['folder/deep/file.md']);
});
test('fuzzy title and path search is bounded', () => {
  const entries = Array.from({ length: 50 }, (_, index) => ({ path: `file${index}.md`, title: 'Architecture' }));
  assert.equal(fuzzyEntries(entries, 'arct').length, 30);
  assert.equal(fuzzyEntries(entries, 'zzz').length, 0);
});
test('session data rejects stale and hostile paths and bounds collections', () => {
  const files = Array.from({ length: 120 }, (_, index) => `${index}.md`);
  const result = validateSession({ version: 1, path: 'gone.md', pins: [...files, '../secret.md'], history: files.map(path => ({ path })), navWidth: 9000 }, files);
  assert.equal(result.path, ''); assert.equal(result.pins.length, 30); assert.equal(result.history.length, 100); assert.equal(result.navWidth, 420);
  assert.equal(validateSession({ version: 99, path: '0.md' }, files).path, '');
  assert.equal(validateSession({ version: 1, position: null, history: [{ path: '0.md', position: null }] }, files).position.offset, 0);
  assert.equal(validateSession({ version: 1, pins: ['../secret.md'] }, ['../secret.md']).pins.length, 0);
});
test('trail and history append retain newest bounded records', () => {
  assert.equal(appendVisit(Array.from({ length: 8 }, () => ({ path: 'old.md' })), { path: 'new.md' }, 8).length, 8);
  assert.equal(appendVisit([], { path: 'new.md' }, 8)[0].path, 'new.md');
});
test('position restoration prefers heading then snippet then offset', () => {
  const position = { heading: 'section', snippet: 'text', delta: 4, offset: 50 };
  assert.deepEqual(restoreTarget(position, [{ id: 'section', text: 'other', top: 100 }]), { offset: 104, fallback: false });
  assert.equal(restoreTarget(position, [{ id: '', text: 'text passage', top: 200 }]).offset, 204);
  assert.equal(restoreTarget(position, []).offset, 50);
  assert.equal(restoreTarget({ ...position, snippetDelta: 12 }, [{ id: '', text: 'text passage', top: 200 }]).offset, 212);
});
