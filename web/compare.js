import { select } from './dom.js';
import { state } from './state.js';
import { showDialog } from './orientation.js';
import { renderArticle } from './rendering.js';
import { cleanDiagrams } from './diagrams.js';
import { alignedOffset, headingKeys } from './review-model.js';

function geometry(pane) {
  return [...pane.querySelectorAll('h1,h2,h3,h4')].map(element => ({ text: element.textContent, top: element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop, element }));
}

export function setupCompare() {
  const dialog = select('#compare-dialog');
  const panes = [...dialog.querySelectorAll('.compare-pane')];
  let generation = 0;
  let syncing = false;
  const load = async () => {
    const current = ++generation, root = state.root;
    select('#compare-status').textContent = 'Loading…';
    try {
      await Promise.all(panes.map(async (pane, index) => {
        const path = select(index ? '#compare-right' : '#compare-left').value;
        const response = await fetch(`/api/file?${new URLSearchParams({ root, path })}`);
        if (!response.ok) throw new Error('Document unavailable');
        const text = await response.text();
        if (current !== generation || root !== state.root) return;
        const article = document.createElement('article');
        article.className = 'compare-article';
        cleanDiagrams(pane); pane.replaceChildren(article);
        await renderArticle(article, text, path, `compare-${index}-`);
        article.onclick = event => {
          const anchor = event.target.closest('a');
          if (!anchor || /^https?:/.test(anchor.getAttribute('href'))) return;
          event.preventDefault(); event.stopPropagation();
          const fragment = anchor.dataset.h || anchor.dataset.frag;
          const heading = [...article.querySelectorAll('[id]')].find(element => element.id === fragment || element.id === `compare-${index}-${fragment}`);
          if (heading) pane.scrollTop += heading.getBoundingClientRect().top - pane.getBoundingClientRect().top;
        };
        pane.scrollTop = 0;
      }));
      if (current !== generation) return;
      const sections = select('#compare-section'); sections.replaceChildren();
      for (const heading of headingKeys(geometry(panes[0]))) {
        const option = document.createElement('option'); option.value = heading.key; option.textContent = heading.text.replace(/^#/, ''); sections.append(option);
      }
      sections.onchange = () => {
        syncing = true;
        for (const pane of panes) {
          const match = headingKeys(geometry(pane)).find(heading => heading.key === sections.value);
          if (match) pane.scrollTop = match.top;
        }
        requestAnimationFrame(() => { syncing = false; });
      };
      select('#compare-status').textContent = 'Aligned by matching headings; proportional scrolling where unmatched.';
    } catch (error) { select('#compare-status').textContent = error.message; }
  };
  panes.forEach((pane, index) => pane.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    const other = panes[1 - index];
    other.scrollTop = alignedOffset(pane.scrollTop, geometry(pane), geometry(other), pane.scrollHeight - pane.clientHeight, other.scrollHeight - other.clientHeight);
    requestAnimationFrame(() => { syncing = false; });
  }));
  select('#compare-open').onclick = () => {
    for (const selector of ['#compare-left', '#compare-right']) {
      const input = select(selector); input.replaceChildren();
      for (const path of state.files) { const option = document.createElement('option'); option.value = path; option.textContent = path; input.append(option); }
    }
    select('#compare-left').value = state.currentPath;
    select('#compare-right').value = state.files.find(path => path !== state.currentPath) || state.currentPath;
    showDialog(dialog); load();
  };
  select('#compare-load').onclick = load;
  dialog.addEventListener('close', () => { generation++; panes.forEach(pane => cleanDiagrams(pane)); });
}
