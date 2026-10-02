import { select, selectAll, escapeHtml } from './dom.js';
import { state } from './state.js';

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
  for (const directory of Object.keys(node.directories).sort()) {
    html += `<details ${open ? 'open' : ''}><summary>${escapeHtml(directory)}</summary><div class="kids">${renderNode(node.directories[directory], open)}</div></details>`;
  }
  for (const file of node.files.sort((left, right) => left.name.localeCompare(right.name))) {
    html += `<a class="f" href="#${encodeURIComponent(file.path)}" data-p="${escapeHtml(file.path)}">${escapeHtml(file.name)}</a>`;
  }
  return html;
}

export function markCurrent() {
  selectAll('#list a.f').forEach(anchor => anchor.classList.toggle('on', anchor.dataset.p === state.currentPath));
  const current = select('#list a.f.on');
  if (!current) return;
  for (let ancestor = current.parentElement; ancestor && ancestor.id !== 'list'; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  }
}

export function renderList() {
  select('#hint').textContent = `${state.files.length} markdown file${state.files.length === 1 ? '' : 's'}`;
  select('#list').innerHTML = state.files.length
    ? renderNode(buildTree(state.files), state.files.length <= 40)
    : '<p class="empty">No markdown files in this folder.</p>';
  markCurrent();
}
