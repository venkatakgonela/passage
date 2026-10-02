import { APP_NAME } from './config.js';
import { select, escapeHtml, requestJson } from './dom.js';
import { state, store } from './state.js';
import { initialFile } from './paths.js';
import { renderList } from './tree.js';

async function loadFiles() {
  store.set('root', state.root);
  state.files = state.root ? await requestJson(`/api/files?root=${state.root}`) : [];
  select('#q').value = '';
  state.searchSequence++;
  state.currentPath = '';
  history.replaceState(null, '', location.pathname);
  select('#doc').innerHTML = '<p class="empty">Select a file from the sidebar.</p>';
  select('#toc').innerHTML = '';
  select('#crumb').textContent = APP_NAME;
  renderList();
  const first = initialFile(state.files);
  if (first) location.hash = encodeURIComponent(first);
}

export async function loadRoots() {
  state.roots = await requestJson('/api/roots');
  if (!state.roots.some(root => root.id === state.root)) state.root = state.roots[0]?.id || '';
  select('#roots').innerHTML = state.roots.map(root =>
    `<option value="${root.id}" title="${escapeHtml(root.path)}">${escapeHtml(root.name)}</option>`).join('');
  select('#roots').value = state.root;
  await loadFiles();
}

async function browse(path) {
  const result = await requestJson(`/api/browse?path=${encodeURIComponent(path || '')}`);
  state.browsePath = result.path;
  select('#bpath').textContent = result.path;
  select('#blist').innerHTML = ((result.parent ? `<a data-p="${escapeHtml(result.parent)}">⬆︎  Up</a>` : '')
    + result.dirs.map(directory => `<a data-p="${escapeHtml(`${result.path}/${directory}`)}">📁  ${escapeHtml(directory)}</a>`).join(''))
    || '<p class="empty">No sub-folders.</p>';
}

export function setupWorkspace() {
  select('#roots').onchange = event => { state.root = event.target.value; loadFiles(); };
  select('#rm').onclick = async () => {
    if (state.root && confirm('Remove this folder from the list? Files are not deleted.')) {
      await requestJson(`/api/roots?id=${state.root}`, { method: 'DELETE' });
      state.root = '';
      await loadRoots();
    }
  };
  select('#blist').onclick = event => { const anchor = event.target.closest('a'); if (anchor) browse(anchor.dataset.p); };
  select('#add').onclick = () => { select('#dlg').showModal(); browse(state.browsePath || ''); };
  select('#bcancel').onclick = () => select('#dlg').close();
  select('#bok').onclick = async () => {
    try {
      const result = await requestJson('/api/roots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: state.browsePath }),
      });
      state.root = result.id;
      select('#dlg').close();
      await loadRoots();
    } catch (error) { alert(error.message); }
  };
}
