import { select, selectAll, toast } from './dom.js';
import { state } from './state.js';
import { session, saveSession } from './session.js';
import { appendVisit, restoreTarget, fuzzyEntries } from './continuity-model.js';
import { documentHash, initialFile } from './paths.js';
import { showDialog, showMenu, updateContext, installOutlineResizer } from './orientation.js';
import { fetchCatalog } from './catalog.js';
import { renderList } from './tree.js';

let activePath = '';
let pendingPosition = null;
let started = false;
let polling = false;

export function capturePosition() {
  const scroller = select('#scroller');
  const boundary = scroller.getBoundingClientRect().top;
  const elements = selectAll('#doc h1,#doc h2,#doc h3,#doc h4,#doc p,#doc li');
  const visible = elements.find(element => !element.closest('.front-matter') && !element.classList.contains('meta') && element.getBoundingClientRect().bottom > boundary + 30);
  const headings = elements.filter(element => /^H[1-4]$/.test(element.tagName));
  const heading = headings.filter(element => element.getBoundingClientRect().top <= (visible?.getBoundingClientRect().top || boundary)).at(-1) || headings[0];
  const anchor = heading || visible;
  const passage = elements.find(element => /^(P|LI)$/.test(element.tagName) && !element.classList.contains('meta') && element.getBoundingClientRect().bottom > boundary + 30) || visible;
  return { heading: heading?.id || '', snippet: passage?.textContent.trim().slice(0, 160) || '', delta: anchor ? boundary - anchor.getBoundingClientRect().top : 0, snippetDelta: passage ? boundary - passage.getBoundingClientRect().top : 0, offset: scroller.scrollTop };
}
export function restorePosition(position, quiet = false) {
  const scroller = select('#scroller');
  const boundary = scroller.getBoundingClientRect().top;
  const candidates = selectAll('#doc h1,#doc h2,#doc h3,#doc h4,#doc p,#doc li').map(element => ({ id: element.id, text: element.textContent.trim(), top: element.getBoundingClientRect().top - boundary + scroller.scrollTop }));
  const target = restoreTarget(position, candidates);
  scroller.scrollTo({ top: target.offset, behavior: 'instant' });
  if (target.fallback && !quiet) toast('Passage changed; restored nearest saved position');
}
function saveCurrent() {
  if (!activePath || select('#doc').dataset.ready !== 'true' || activePath !== state.currentPath) return;
  const position = capturePosition();
  session.path = activePath; session.position = position;
  if (session.history.at(-1)?.path === activePath) session.history[session.history.length - 1].position = position;
  const current = history.state;
  if (current?.reader?.root === state.root && current.reader.path === activePath) history.replaceState({ ...current, reader: { root: state.root, path: activePath, position } }, '', location.href);
  saveSession();
}
export function visit(path, heading = '', position = null, trail = false) {
  if (!state.files.includes(path)) { toast('Document is no longer available'); return; }
  saveCurrent();
  if (trail && activePath) session.trail = appendVisit(session.trail, { path: activePath, position: capturePosition() }, 8);
  pendingPosition = position;
  const target = documentHash(path, heading);
  if (location.hash === target) {
    if (position) restorePosition(position);
    else if (heading) document.getElementById(heading)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    pendingPosition = null;
  } else {
    if (path !== activePath) select('#doc').dataset.ready = 'false';
    location.hash = target;
  }
  saveSession(); updateTrail();
}
function updateTrail() {
  const last = session.trail.at(-1);
  select('#trail-bar').hidden = !last;
  if (last) select('#trail-return').textContent = `Back to ${last.position.heading || 'passage'} in ${last.path}`;
}
function returnTrail() {
  const record = session.trail.pop();
  if (record) visit(record.path, '', record.position);
  saveSession(); updateTrail();
}
function ready() {
  if (!state.files.includes(state.currentPath)) return;
  activePath = state.currentPath;
  updateContext(); installOutlineResizer(); updateTrail();
  if (pendingPosition) { restorePosition(pendingPosition, !started); pendingPosition = null; }
  else if (!started && session.path === activePath) restorePosition(session.position, true);
  started = true;
  session.path = activePath;
  session.position = capturePosition();
  session.history = appendVisit(session.history, { path: activePath, position: session.position }, 100);
  session.recents = [activePath, ...session.recents.filter(path => path !== activePath)].slice(0, 30);
  history.replaceState({ ...history.state, reader: { root: state.root, path: activePath, position: session.position } }, '', location.href);
  saveSession();
}

function currentEntry(record) {
  return record && record.root === state.root && state.files.includes(record.path);
}
export function openQuick() {
  const input = select('#quick-query'); input.value = '';
  const update = () => {
    const results = select('#quick-results'); results.replaceChildren();
    for (const item of fuzzyEntries(state.catalog, input.value)) {
      const button = document.createElement('button'); button.textContent = `${item.title} — ${item.path}`;
      button.onclick = () => { select('#quick-dialog').close(); visit(item.path); }; results.append(button);
    }
  };
  input.oninput = update; update(); showDialog(select('#quick-dialog')); input.focus();
}
async function poll() {
  if (document.hidden || polling || !state.root || !activePath || select('#doc').dataset.ready !== 'true') return;
  polling = true;
  try {
    const root = state.root;
    const path = activePath;
    const next = await fetchCatalog(false);
    if (!next || root !== state.root || path !== activePath) return;
    const previous = state.catalog.find(item => item.path === activePath);
    const current = next.find(item => item.path === activePath);
    const changed = JSON.stringify(next.map(item => [item.path, item.modified, item.size])) !== JSON.stringify(state.catalog.map(item => [item.path, item.modified, item.size]));
    if (!changed) return;
    const refreshed = await fetchCatalog(true);
    if (root !== state.root || path !== activePath) return;
    state.catalog = refreshed || next; state.files = state.catalog.map(item => item.path);
    session.pins = session.pins.filter(path => state.files.includes(path)); session.recents = session.recents.filter(path => state.files.includes(path));
    renderList();
    if (!current) { const first = initialFile(state.files); if (first) visit(first); else { select('#doc').textContent = 'No documents available.'; activePath = ''; session.path = ''; } toast('Document removed; showing available content'); }
    else if (!previous || current.modified !== previous.modified || current.size !== previous.size) {
      pendingPosition = capturePosition();
      const { openDocument } = await import('./rendering.js'); await openDocument(true); toast('Updated');
    }
    saveSession();
  } catch { toast('Refresh unavailable; keeping current document'); }
  finally { polling = false; }
}
export function setupContinuity() {
  history.scrollRestoration = 'manual';
  document.addEventListener('workspace-loaded', () => { activePath = ''; started = false; pendingPosition = null; updateTrail(); });
  document.addEventListener('document-ready', ready);
  addEventListener('popstate', event => { const record = event.state?.reader; if (currentEntry(record)) pendingPosition = record.position; });
  let timer;
  select('#scroller').addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(saveCurrent, 120); }, { passive: true });
  addEventListener('pagehide', saveCurrent);
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    if (link.dataset.md && link.closest('#doc')) { event.preventDefault(); event.stopImmediatePropagation(); visit(link.dataset.md, link.dataset.frag || '', null, true); }
    else if (link.dataset.p && link.closest('#list')) { event.preventDefault(); visit(link.dataset.p); }
    else if (link.dataset.h && link.closest('#doc,#toc')) { event.preventDefault(); event.stopImmediatePropagation(); visit(state.currentPath, link.dataset.h); }
  }, true);
  select('#trail-return').onclick = returnTrail;
  select('#trail-list').onclick = () => showMenu('Trail', [...session.trail].reverse().map(record => [record.path, () => visit(record.path, '', record.position)]));
  select('#navigate-menu').onclick = () => showMenu('Navigate', [
    ['Quick open', openQuick], ['Back', () => history.back()], ['Forward', () => history.forward()],
    ['History', () => showMenu('History', [...session.history].reverse().map(record => [record.path + ' · ' + (record.position.heading || 'top'), () => visit(record.path, '', record.position)]))],
    [session.pins.includes(activePath) ? 'Unpin current file' : 'Pin current file', () => { session.pins = session.pins.includes(activePath) ? session.pins.filter(path => path !== activePath) : [activePath, ...session.pins].slice(0, 30); saveSession(); }],
    ['Pins', () => showMenu('Pins', session.pins.map(path => [path, () => visit(path)]))],
    ['Recents', () => showMenu('Recents', session.recents.map(path => [path, () => visit(path)]))],
  ]);
  select('#quick-dialog').addEventListener('keydown', event => {
    const buttons = selectAll('#quick-results button'); const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
    if (event.key === 'Enter' && document.activeElement === select('#quick-query')) { event.preventDefault(); buttons[0]?.click(); }
  });
  addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && !select('dialog[open]')) { event.preventDefault(); openQuick(); }
    if (event.altKey && event.key === 'ArrowLeft' && document.activeElement.closest('#scroller')) { event.preventDefault(); returnTrail(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); else saveCurrent(); });
  setInterval(poll, 4000);
}
