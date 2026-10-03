import { select, escapeHtml, requestJson } from './dom.js';
import { state } from './state.js';
import { renderList, markCurrent } from './tree.js';
import { visit } from './continuity.js';
import { showDialog } from './orientation.js';

let saved = null;

export function highlight(text, query) {
  const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return text.split(pattern).map((part, index) => index % 2
    ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)).join('');
}

export async function search(query) {
  const sequence = ++state.searchSequence;
  const parameters = new URLSearchParams({ root: state.root, q: query, format: 'details', scope: select('#search-scope').value, path: state.currentPath,
    phrase: select('#search-phrase').checked, case: select('#search-case').checked, word: select('#search-word').checked });
  let result;
  try { result = await requestJson(`/api/search?${parameters}`); }
  catch (error) { select('#hint').textContent = error.message; return; }
  if (sequence !== state.searchSequence) return;
  const hits = result.hits || [];
  saved = { query, hits, truncated: result.truncated, scroll: 0 };
  select('#back-results').hidden = false;
  select('#hint').textContent = `${hits.length} result${hits.length === 1 ? '' : 's'} for “${query}”`;
  select('#list').innerHTML = hits.length ? hits.map(hit =>
    `<a class="f" href="#${encodeURIComponent(hit.path)}" data-p="${escapeHtml(hit.path)}">${highlight(hit.path, query)}${hit.snippet ? `<small>…${highlight(hit.snippet, query)}…</small>` : ''}</a>`
  ).join('') : '<p class="empty">Nothing found.</p>';
  markCurrent();
  select('#hint').textContent += result.truncated ? ' · Results truncated (work or hit limit)' : '';
}

function showResults() {
  if (!saved) return;
  const container = select('#search-results');
  container.innerHTML = `<p>${saved.hits.length} results for ${escapeHtml(saved.query)}${saved.truncated ? ' · Results truncated' : ''}. Ranking: filename matches, content count, then path.</p>`;
  for (const hit of saved.hits) {
    const button = document.createElement('button');
    button.innerHTML = `${highlight(hit.path, saved.query)}<small>${highlight(hit.snippet, saved.query)}</small>`;
    button.onclick = () => { saved.scroll = container.scrollTop; select('#results-dialog').close(); visit(hit.path); };
    container.append(button);
  }
  showDialog(select('#results-dialog'));
  container.scrollTop = saved.scroll;
}

export function setupSearch() {
  select('#list').addEventListener('click', event => { if (saved && event.target.closest('a.f')) saved.scroll = select('#list').scrollTop; }, true);
  select('#back-results').onclick = showResults;
  document.addEventListener('workspace-loaded', () => { saved = null; select('#back-results').hidden = true; });
  for (const control of document.querySelectorAll('#search-options input,#search-options select')) control.onchange = () => {
    if (select('#q').value.trim().length >= 2) search(select('#q').value.trim());
  };
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
