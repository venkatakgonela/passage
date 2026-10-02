import { select, selectAll } from './dom.js';
import { state } from './state.js';
import { session, saveSession } from './session.js';
import { renderList, markCurrent } from './tree.js';
import { documentHash } from './paths.js';

export function showDialog(dialog) {
  const focused = document.activeElement;
  dialog.showModal();
  dialog.addEventListener('close', () => {
    if (document.activeElement === document.body || dialog.contains(document.activeElement)) focused?.focus();
  }, { once: true });
}
export function showMenu(title, actions) {
  const dialog = select('#reader-menu');
  select('#reader-menu-title').textContent = title;
  const content = select('#reader-menu-items'); content.replaceChildren();
  for (const [label, action] of actions) {
    const button = document.createElement('button'); button.textContent = label;
    button.onclick = () => { dialog.close(); action(); };
    content.append(button);
  }
  showDialog(dialog);
}
export function updateContext() {
  const crumb = select('#crumb'); crumb.replaceChildren();
  const parts = state.currentPath.split('/');
  const root = document.createElement('button');
  root.textContent = state.roots.find(item => item.id === state.root)?.name || 'Workspace';
  const folderMenu = directory => showMenu(directory || 'Workspace files', state.files.filter(path => path.startsWith(directory) && !path.slice(directory.length).includes('/')).slice(0, 100).map(path => [path.slice(directory.length), () => { location.hash = documentHash(path); }]));
  root.onclick = () => folderMenu(''); crumb.append(root);
  for (let index = 0; index < parts.length - 1; index++) {
    const button = document.createElement('button'); button.textContent = parts[index];
    const directory = parts.slice(0, index + 1).join('/') + '/';
    button.onclick = () => folderMenu(directory); crumb.append(' / ', button);
  }
  const current = document.createElement('span'); current.textContent = parts.at(-1) || ''; crumb.append(' / ', current);
  const metadata = state.catalog.find(item => item.path === state.currentPath);
  const meta = select('#doc .meta');
  if (meta && metadata) meta.textContent = meta.textContent.split(' · Modified ')[0] + ` · Modified ${new Date(metadata.modified).toLocaleString()}`;
}
export function applyPanels() {
  document.documentElement.style.setProperty('--nav-width', `${session.navWidth}px`);
  document.documentElement.style.setProperty('--toc-width', `${session.tocWidth}px`);
  for (const [identifier, width, minimum, maximum] of [['nav-resizer', session.navWidth, 200, 420], ['toc-resizer', session.tocWidth, 160, 320]]) {
    const element = select('#' + identifier);
    if (element) { element.setAttribute('aria-valuenow', width); element.setAttribute('aria-valuemin', minimum); element.setAttribute('aria-valuemax', maximum); }
  }
}
export function installOutlineResizer() {
  if (!select('#toc-resizer') && select('#toc').children.length) {
    const element = document.createElement('div'); element.id = 'toc-resizer'; element.className = 'resizer'; element.tabIndex = 0;
    element.setAttribute('role', 'separator'); element.setAttribute('aria-label', 'Outline width'); element.setAttribute('aria-orientation', 'vertical');
    select('#toc').prepend(element); setupResizer(element, 'tocWidth', -1, 160, 320); applyPanels();
  }
}
function setupResizer(element, key, direction, minimum, maximum) {
  const change = width => { session[key] = Math.max(minimum, Math.min(maximum, width)); applyPanels(); saveSession(); };
  element.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); change(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : session[key] + (event.key === 'ArrowRight' ? 10 : -10) * direction);
    }
  });
  element.addEventListener('pointerdown', event => {
    element.setPointerCapture(event.pointerId);
    const start = event.clientX; const width = session[key];
    const move = next => change(width + (next.clientX - start) * direction);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', () => element.removeEventListener('pointermove', move), { once: true });
  });
}
export function setupOrientation() {
  selectAll('[data-close-dialog]').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
  select('#tree-filter').oninput = renderList;
  select('#reveal-current').onclick = () => { select('#tree-filter').value = ''; renderList(); markCurrent(); select('#list a.on')?.focus(); select('#list a.on')?.scrollIntoView({ block: 'nearest' }); };
  select('#collapse-all').onclick = () => selectAll('#list details:not(.workspace-root)').forEach(element => { element.open = false; });
  setupResizer(select('#nav-resizer'), 'navWidth', 1, 200, 420);
  document.addEventListener('workspace-loaded', () => { applyPanels(); if (innerWidth > 820) select('#nav').classList.toggle('hide', session.navHidden); });
  select('#navtog').addEventListener('click', () => { session.navHidden = select('#nav').classList.contains('hide'); saveSession(); });
  select('#view-menu').onclick = () => showMenu('View', [
    ['Sort by name', () => { session.sort = 'name'; saveSession(); renderList(); }],
    ['Sort by last modified', () => { session.sort = 'modified'; saveSession(); renderList(); }],
    [session.descending ? 'Ascending order' : 'Descending order', () => { session.descending = !session.descending; saveSession(); renderList(); }],
    [session.titles ? 'Filename-only mode' : 'Show titles', () => { session.titles = !session.titles; saveSession(); renderList(); }],
    [session.extensions ? 'Hide extensions' : 'Show extensions', () => { session.extensions = !session.extensions; saveSession(); renderList(); }],
    ['Reading appearance', () => select('#appearance').click()], ['Focus mode', () => select('#focus').click()],
  ]);
  select('#file-menu').onclick = () => showMenu('File', [['Add workspace', () => select('#add').click()], ['Remove workspace from reader', () => select('#rm').click()], ['Print', () => select('#print').click()]]);
  select('#scroller').addEventListener('scroll', () => {
    const top = select('#scroller').getBoundingClientRect().top + 60;
    const headings = selectAll('#doc h1,#doc h2,#doc h3,#doc h4');
    const heading = headings.filter(item => item.getBoundingClientRect().top <= top).at(-1) || headings[0];
    select('#current-section').textContent = heading?.textContent.replace(/^#/, '') || '';
  }, { passive: true });
}
