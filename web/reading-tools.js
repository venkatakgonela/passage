import { select, selectAll, toast } from './dom.js';
import { state } from './state.js';
import { slug } from './paths.js';
import { showDialog } from './orientation.js';
import { visit } from './continuity.js';

export async function peek(link) {
  const root = state.root;
  const path = link.dataset.md || state.currentPath;
  const heading = link.dataset.frag || link.dataset.h || '';
  if (!state.files.includes(path)) { toast('Document is not available'); return; }
  const response = await fetch(`/api/file?root=${state.root}&path=${encodeURIComponent(path)}`);
  if (!response.ok) { toast('Preview unavailable'); return; }
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(marked.parse(await response.text()));
  if (root !== state.root || !link.isConnected) return;
  template.content.querySelectorAll('img,iframe,video,audio,source,object,embed,style').forEach(element => element.remove());
  const used = new Set();
  const headings = [...template.content.querySelectorAll('h1,h2,h3,h4')];
  headings.forEach(element => { element.id = slug(element.textContent, used); });
  const start = headings.find(element => element.id === heading) || headings[0];
  const content = select('#peek-content'); content.replaceChildren();
  if (start) {
    const level = Number(start.tagName.slice(1)); let element = start;
    while (element) {
      const next = element.nextElementSibling;
      if (element !== start && /^H[1-6]$/.test(element.tagName) && (Number(element.tagName.slice(1)) <= level || !heading)) break;
      content.append(element); element = next;
    }
  } else content.textContent = template.content.textContent.slice(0, 4000);
  content.querySelectorAll('a').forEach(anchor => { anchor.removeAttribute('href'); });
  select('#peek-title').textContent = `Peek: ${path}${heading ? ' · ' + heading : ''}`;
  select('#peek-open').onclick = () => { select('#peek-dialog').close(); visit(path, heading, null, true); };
  showDialog(select('#peek-dialog'));
}
export function decoratePeek() {
  selectAll('#doc a[data-md],#doc a[data-h]:not(.a)').filter(anchor => !anchor.nextElementSibling?.classList.contains('peek-button')).forEach(anchor => {
    const button = document.createElement('button'); button.className = 'peek-button'; button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'; button.title = `Peek ${anchor.textContent}`; button.setAttribute('aria-label', button.title); button.onclick = () => peek(anchor); anchor.after(button);
  });
}
let matches = []; let matchIndex = -1;
function clearMatches() {
  selectAll('#doc mark.find-match').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
  select('#doc').normalize(); matches = []; matchIndex = -1;
}
function find() {
  clearMatches();
  const query = select('#find-query').value.toLowerCase().slice(0, 200);
  if (query) {
    const walker = document.createTreeWalker(select('#doc'), NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement.closest('.diagram-shell,math,button,script,style,.meta') || matches.length >= 1000) continue;
      const text = node.textContent; const lower = text.toLowerCase(); const fragment = document.createDocumentFragment(); let start = 0; let found;
      while ((found = lower.indexOf(query, start)) >= 0 && matches.length < 1000) {
        fragment.append(text.slice(start, found)); const mark = document.createElement('mark'); mark.className = 'find-match'; mark.textContent = text.slice(found, found + query.length); fragment.append(mark); matches.push(mark); start = found + query.length;
      }
      if (start) { fragment.append(text.slice(start)); node.replaceWith(fragment); }
    }
  }
  nextMatch(1);
}
function nextMatch(direction) {
  matches.forEach(mark => mark.classList.remove('find-current'));
  if (matches.length) { matchIndex = (matchIndex + direction + matches.length) % matches.length; matches[matchIndex].classList.add('find-current'); matches[matchIndex].scrollIntoView({ block: 'center' }); }
  select('#find-count').textContent = `${matches.length ? matchIndex + 1 : 0} / ${matches.length}`;
}
export function setupReadingTools() {
  document.addEventListener('document-ready', () => { decoratePeek(); if (!select('#find-bar').hidden) find(); });
  select('#find-query').oninput = find;
  select('#find-next').onclick = () => nextMatch(1); select('#find-prev').onclick = () => nextMatch(-1);
  select('#find-close').onclick = () => { clearMatches(); select('#find-bar').hidden = true; select('#scroller').focus(); };
  addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && document.activeElement.closest('#scroller') && !select('dialog:modal')) { event.preventDefault(); select('#find-bar').hidden = false; select('#find-query').focus(); }
    if (event.key === 'Escape' && document.activeElement.closest('#find-bar')) { event.preventDefault(); select('#find-close').click(); }
    if (event.key === 'Enter' && document.activeElement === select('#find-query')) { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1); }
  });
}
