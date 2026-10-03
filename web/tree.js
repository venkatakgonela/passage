import { select, selectAll, escapeHtml } from './dom.js';
import { state } from './state.js';
import { session } from './session.js';
import { sortEntries, filterEntries } from './continuity-model.js';
import { icon } from './icons.js';

export function buildTree(paths) {
  const tree = { directories: Object.create(null), files: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let node = tree;
    for (const directory of parts.slice(0, -1)) {
      node = node.directories[directory] ??= { directories: Object.create(null), files: [] };
    }
    node.files.push({ name: parts.at(-1), path });
  }
  return tree;
}

export function renderNode(node, open) {
  let html = '';
  for (const directory of Object.keys(node.directories).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }) * (session.descending ? -1 : 1))) {
    html += `<details ${open ? 'open' : ''}><summary>${icon('folder')}${escapeHtml(directory)}</summary><div class="kids">${renderNode(node.directories[directory], open)}</div></details>`;
  }
  for (const file of sortEntries(node.files.map(file => ({ ...file, ...state.catalog.find(item => item.path === file.path) })), session)) {
    const filename = session.extensions ? file.name : file.name.replace(/\.md$/i, '');
    const title = session.titles && file.title ? file.title : filename;
    html += `<a class="f" href="#${encodeURIComponent(file.path)}" data-p="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}">${icon('file')}<span>${escapeHtml(title)}${title !== filename ? `<small>${escapeHtml(filename)}</small>` : ''}</span></a>`;
  }
  return html;
}

export function markCurrent() {
  selectAll('#list details').forEach(element => element.classList.remove('ancestor'));
  selectAll('#list a.f').forEach(anchor => anchor.classList.toggle('on', anchor.dataset.p === state.currentPath));
  const current = select('#list a.f.on');
  selectAll('#list summary,#list a.f').forEach(element => element.tabIndex = element === (current || select('#list summary')) ? 0 : -1);
  if (!current) return;
  for (let ancestor = current.parentElement; ancestor && ancestor.id !== 'list'; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') { ancestor.open = true; ancestor.classList.add('ancestor'); }
  }
}

export function renderList() {
  select('#hint').textContent = `${state.files.length} markdown file${state.files.length === 1 ? '' : 's'}`;
  const query = select('#tree-filter')?.value || '';
  const paths = filterEntries(state.files.map(path => state.catalog.find(item => item.path === path) || { path, title: path }), query).map(item => item.path);
  select('#list').innerHTML = state.files.length
    ? `<details open class="workspace-root"><summary>${icon('root')}${escapeHtml(state.roots.find(root => root.id === state.root)?.name || 'Workspace')}</summary><div class="kids">${renderNode(buildTree(paths), !!query || state.files.length <= 40)}</div></details>`
    : '<p class="empty">No markdown files in this folder.</p>';
  markCurrent();
}
