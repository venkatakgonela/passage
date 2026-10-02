import { select, escapeHtml, requestJson } from './dom.js';
import { state } from './state.js';
import { renderList, markCurrent } from './tree.js';

export function highlight(text, query) {
  const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return text.split(pattern).map((part, index) => index % 2
    ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)).join('');
}

export async function search(query) {
  const sequence = ++state.searchSequence;
  const hits = await requestJson(`/api/search?root=${state.root}&q=${encodeURIComponent(query)}`);
  if (sequence !== state.searchSequence) return;
  select('#hint').textContent = `${hits.length} result${hits.length === 1 ? '' : 's'} for “${query}”`;
  select('#list').innerHTML = hits.length ? hits.map(hit =>
    `<a class="f" href="#${encodeURIComponent(hit.path)}" data-p="${escapeHtml(hit.path)}">${highlight(hit.path, query)}${hit.snippet ? `<small>…${highlight(hit.snippet, query)}…</small>` : ''}</a>`
  ).join('') : '<p class="empty">Nothing found.</p>';
  markCurrent();
}

export function setupSearch() {
  let timer;
  select('#q').oninput = () => {
    clearTimeout(timer);
    const query = select('#q').value.trim();
    if (query.length < 2) {
      state.searchSequence++;
      renderList();
      return;
    }
    timer = setTimeout(() => search(query), 180);
  };
}
