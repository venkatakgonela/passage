import { APP_NAME } from './config.js';
import { select, escapeHtml, requestJson } from './dom.js';
import { state, store } from './state.js';
import { initialFile } from './paths.js';
import { renderList } from './tree.js';
import { fetchCatalog } from './catalog.js';
import { loadSession } from './session.js';
import { recovery } from './recovery.js';
import { askConfirmation, actionStatus } from './dialogs.js';
import { showDialog } from './orientation.js';

async function loadFiles() {
  store.set('root', state.root);
  state.files = state.root ? await requestJson(`/api/files?root=${state.root}`) : [];
  state.catalog = state.root ? await fetchCatalog() || [] : [];
  const saved = loadSession();
  document.dispatchEvent(new Event('workspace-loaded'));
  select('#q').value = '';
  state.searchSequence++;
  state.currentPath = '';
  history.replaceState(null, '', location.pathname);
  select('#doc').innerHTML = '<p class="empty">Select a file from the sidebar.</p>';
  select('#toc').innerHTML = '';
  select('#crumb').textContent = APP_NAME;
  renderList();
  const first = saved.path || initialFile(state.files);
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
  const reload = () => loadFiles().catch(() => recovery(select('#doc'), 'Workspace unavailable. Check the folder and server, or select another workspace.', reload));
  select('#roots').onchange = event => { state.root = event.target.value; reload(); };
  select('#rm').onclick = async () => {
    const root = state.root;
    if (root && await askConfirmation('Remove this folder from the list? Files are not deleted.', 'Remove folder')) {
      try {
        actionStatus(select('.nav-top'), '');
        await requestJson(`/api/roots?id=${root}`, { method: 'DELETE' });
        state.root = '';
        await loadRoots();
      } catch (error) { actionStatus(select('.nav-top'), error.message); }
    }
  };
  const browseSafely = path => { actionStatus(select('#dlg'), ''); return browse(path).catch(error => actionStatus(select('#dlg'), error.message)); };
  select('#blist').onclick = event => { const anchor = event.target.closest('a'); if (anchor) browseSafely(anchor.dataset.p); };
  select('#add').onclick = () => { showDialog(select('#dlg')); browseSafely(state.browsePath || ''); };
  select('#bcancel').onclick = () => select('#dlg').close();
  select('#bok').onclick = async () => {
    try {
      const result = await requestJson('/api/roots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: state.browsePath }),
      });
      state.root = result.id;
      await loadRoots();
      select('#dlg').close();
    } catch (error) { actionStatus(select('#dlg'), error.message); }
  };
}
