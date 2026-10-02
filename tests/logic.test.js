import test from 'node:test';
import assert from 'node:assert/strict';
import { slug, resolvePath, initialFile } from '../web/paths.js';
import { buildTree, renderNode } from '../web/tree.js';
import { createStore } from '../web/state.js';
import { STORAGE_PREFIX } from '../web/config.js';
import { highlight } from '../web/search.js';

test('relative paths preserve parent, root and dot semantics', () => {
  assert.equal(resolvePath('notes/deep/', '../report.md'), 'notes/report.md');
  assert.equal(resolvePath('notes/', '/task.md'), 'task.md');
  assert.equal(resolvePath('', '../../task.md'), 'task.md');
  assert.equal(resolvePath('notes/', './detail.md'), 'notes/detail.md');
});

test('heading identifiers retain Unicode and disambiguate duplicates', () => {
  const used = new Set();
  assert.equal(slug('Hello, World!', used), 'hello-world');
  assert.equal(slug('Hello World', used), 'hello-world-2');
  assert.equal(slug('東京 café', used), '東京-café');
  assert.equal(slug('!!!', used), 'section');
  assert.equal(slug('?', used), 'section-2');
});

test('initial selection prefers README, then first file', () => {
  assert.equal(initialFile(['a.md', 'ReadMe.md']), 'ReadMe.md');
  assert.equal(initialFile(['z.md', 'a.md']), 'z.md');
  assert.equal(initialFile([]), undefined);
});

test('tree preserves folders-first ordering and escapes names', () => {
  const tree = buildTree(['z.md', 'a.md', 'folder/deep.md', '<unsafe>.md']);
  assert.equal(tree.directories.folder.files[0].path, 'folder/deep.md');
  const html = renderNode(tree, true);
  assert.ok(html.indexOf('<details open>') < html.indexOf('data-p="a.md"'));
  assert.ok(html.includes('&lt;unsafe&gt;.md'));
});

test('prototype-shaped folder names are ordinary data', () => {
  const tree = buildTree(['__proto__/safe.md', 'constructor/other.md']);
  assert.equal(tree.directories.__proto__.files[0].name, 'safe.md');
  assert.equal({}.files, undefined);
});

test('storage is namespaced and tolerates inaccessible storage', () => {
  const values = new Map();
  const store = createStore(() => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }));
  store.set('theme', 'dark');
  assert.equal(values.get(STORAGE_PREFIX + 'theme'), 'dark');
  assert.equal(values.has('theme'), false);
  assert.equal(store.get('theme'), 'dark');
  const blocked = createStore(() => { throw new Error('blocked'); });
  assert.equal(blocked.get('theme'), null);
  assert.doesNotThrow(() => blocked.set('theme', 'dark'));
});

test('search highlights literal queries without corrupting HTML escaping', () => {
  assert.equal(highlight('Hello hello', 'hello'), '<mark>Hello</mark> <mark>hello</mark>');
  assert.equal(highlight('a+b [x]', '+b'), 'a<mark>+b</mark> [x]');
  assert.equal(highlight('<img onerror="bad">', 'img'), '&lt;<mark>img</mark> onerror=&quot;bad&quot;&gt;');
  assert.equal(highlight('&lt;', 'lt'), '&amp;<mark>lt</mark>;');
});
