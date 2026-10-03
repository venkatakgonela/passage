import { select } from './dom.js';
import { store } from './state.js';
import { appearance, setAppearance } from './appearance.js';
import { showMenu, showDialog } from './orientation.js';
import { session, saveSession } from './session.js';
import { renderList } from './tree.js';

const paths = {
  files: 'M3 6h7l2 3h9v11H3Z', search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  lists: 'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1', notes: 'M4 3h16v18H4ZM8 7h8M8 11h8M8 15h4',
  compare: 'M3 4h7v16H3ZM14 4h7v16h-7Z', appearance: 'M12 3a9 9 0 1 0 0 18V3Z',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6', labels: 'M4 5h16v14H4ZM9 5v14',
  more: 'M5 12h1M11 12h1M17 12h1', reveal: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z', collapse: 'm6 8 6 6 6-6', close: 'm6 6 12 12M6 18 18 6', outline: 'M4 5h16M4 12h12M4 19h8',
};
function glyph(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`; }
function button(id, label, name, action) {
  const element = document.createElement('button'); element.id = id; element.type = 'button'; element.title = label; element.setAttribute('aria-label', label);
  element.innerHTML = glyph(name) + `<span>${label}</span>`; element.onclick = action; return element;
}
let active = 'files', returnFocus = null, rightView = false;
export function closePanel() {
  const panel = select('#nav');
  panel.classList.add('hide'); panel.removeAttribute('aria-modal'); panel.removeAttribute('role');
  for (const dialog of panel.querySelectorAll('dialog[open]')) dialog.close();
  selectAllRail(null); session.navHidden = true; saveSession();
  if (returnFocus?.getClientRects().length && !panel.contains(returnFocus)) returnFocus.focus();
  else select(innerWidth < 1024 ? '#navtog' : '#rail-files').focus();
}
function selectAllRail(section) {
  document.querySelectorAll('button[data-section]').forEach(element => { if (element.dataset.section === section) element.setAttribute('aria-current', 'page'); else element.removeAttribute('aria-current'); });
}
export function openPanel(section = 'files', toggle = false) {
  if (appearance.focus) setAppearance({ focus: false });
  const panel = select('#nav');
  if (toggle && active === section && !panel.classList.contains('hide')) { closePanel(); return; }
  if (!panel.contains(document.activeElement)) returnFocus = document.activeElement;
  active = section; panel.dataset.section = section; panel.classList.remove('hide');
  selectAllRail(section); session.navHidden = false; saveSession();
  if (innerWidth < 1024) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
  else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  for (const dialog of document.querySelectorAll('dialog[data-panel]')) {
    if (dialog.dataset.panel !== section && dialog.open) dialog.close();
    if (dialog.dataset.panel === section) panel.append(dialog);
  }
  select('#panel-title').textContent = { files: 'Files', search: 'Search contents', lists: 'Reading lists', notes: 'Review notes' }[section];
  select('#files-view').hidden = !['files', 'search'].includes(section);
  select('#tree-filter').hidden = section !== 'files';
  select('#search-view').hidden = section !== 'search';
  select('.tree-actions').hidden = section !== 'files';
  if (section === 'files') { select('#q').value = ''; renderList(); }
  for (const sectionName of ['lists', 'notes']) select(`#${sectionName}-dialog [data-close-dialog]`).onclick = closePanel;
  if (section === 'search') select('#q').focus();
  else if (innerWidth < 1024) select('#panel-close').focus();
}
function chooseSection(section, toggle = true) {
  if (section === 'compare') { select('#compare-open').click(); return; }
  if (toggle && active === section && !select('#nav').classList.contains('hide')) { closePanel(); return; }
  openPanel(section);
  if (section === 'lists' || section === 'notes') select(`#${section}-open`).click();
}
function openOutline() {
  const outline = select('#right-panel'); const opening = !outline.classList.contains('open');
  outline.classList.toggle('open', opening);
  outline.classList.remove('collapsed');
  if (opening && innerWidth < 1280) { returnFocus = document.activeElement; outline.setAttribute('role', 'dialog'); outline.setAttribute('aria-modal', 'true'); select('#outline-close').focus(); }
}
function quickOpen() { select('#scroller').focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })); }

export function setupShell() {
  document.body.classList.add('reader-shell');
  const nav = select('#nav'), scroller = select('#scroller'), header = select('header');
  const bank = document.createElement('div'); bank.id = 'action-bank'; bank.hidden = true; document.body.append(bank);
  bank.append(select('#review-tools'));
  const rail = document.createElement('aside'); rail.id = 'rail'; rail.setAttribute('aria-label', 'Reader sections');
  const logo = document.createElement('div'); logo.className = 'rail-brand'; logo.textContent = 'P'; logo.title = 'Passage'; rail.append(logo);
  const tabs = document.createElement('div'); tabs.id = 'panel-tabs'; tabs.setAttribute('aria-label', 'Reader sections');
  for (const [section, label] of [['files', 'Files · b'], ['search', 'Search contents · /'], ['lists', 'Reading lists'], ['notes', 'Review notes'], ['compare', 'Compare']]) {
    const trigger = button(`rail-${section}`, label, section, () => chooseSection(section)); trigger.dataset.section = section; rail.append(trigger);
    const tab = button(`tab-${section}`, label, section, () => chooseSection(section, false)); tab.dataset.section = section; tabs.append(tab);
  }
  const bottom = document.createElement('div'); bottom.className = 'rail-bottom';
  bottom.append(button('rail-appearance', 'Appearance', 'appearance', () => select('#appearance').click()), button('rail-settings', 'Settings and help', 'settings', () => showMenu('Settings and help', [['Reading appearance', () => select('#appearance').click()], ['Commands and keyboard map · Ctrl/Cmd+K', () => select('#commands-open').click()], ['Tree preferences', () => select('#view-menu').click()]])), button('rail-labels', 'Show rail labels', 'labels', () => { rail.classList.toggle('expanded'); store.set('rail-labels', String(rail.classList.contains('expanded'))); select('#rail-labels').setAttribute('aria-expanded', String(rail.classList.contains('expanded'))); })); rail.append(bottom);
  rail.classList.toggle('expanded', store.get('rail-labels') === 'true'); rail.querySelector('#rail-labels').setAttribute('aria-expanded', String(rail.classList.contains('expanded')));
  select('.layout').prepend(rail);
  const top = document.createElement('div'); top.className = 'panel-heading';
  const title = document.createElement('strong'); title.id = 'panel-title'; title.textContent = 'Files';
  top.append(title, button('panel-close', 'Close panel', 'close', closePanel)); nav.prepend(top, tabs);
  const files = document.createElement('section'); files.id = 'files-view'; files.append(select('.nav-top'), select('#list')); nav.append(files);
  select('.nav-top > strong').remove();
  const rootrow = select('.rootrow');
  bank.append(select('#add'), select('#rm'));
  rootrow.append(button('workspace-actions', 'Workspace actions', 'more', () => showMenu('Workspace', [['Add folder', () => select('#add').click()], ['Remove folder', () => select('#rm').click()]])));
  const searchView = document.createElement('div'); searchView.id = 'search-view'; searchView.hidden = true; searchView.append(select('#q'), select('#search-options')); select('.nav-top').append(searchView);
  select('#q').setAttribute('aria-label', 'Search contents'); select('#q').placeholder = 'Search contents'; select('#tree-filter').placeholder = 'Filter files';
  for (const [id, name, label] of [['reveal-current', 'reveal', 'Reveal current file'], ['collapse-all', 'collapse', 'Collapse all']]) { const control = select('#' + id); control.innerHTML = glyph(name); control.title = label; control.setAttribute('aria-label', label); }
  select('.tree-actions').append(button('tree-preferences', 'Tree preferences', 'settings', () => select('#view-menu').click()));
  files.append(select('#hint'));
  for (const section of ['lists', 'notes']) { const dialog = select(`#${section}-dialog`); dialog.dataset.panel = section; nav.append(dialog); }
  select('#results-dialog').dataset.panel = 'search'; nav.append(select('#results-dialog'));
  select('#results-dialog [data-close-dialog]').onclick = closePanel;
  select('#search-view').append(select('#back-results'));
  for (const section of ['lists', 'notes']) select(`#${section}-dialog [data-close-dialog]`).onclick = closePanel;
  for (const id of ['file-menu', 'view-menu', 'navigate-menu', 'fsm', 'fsp', 'theme', 'print', 'focus']) bank.append(select('#' + id));
  select('.sep').remove(); header.id = 'page-header'; header.className = 'page-header';
  select('#current-section').hidden = true;
  const toggle = select('#navtog'); document.body.append(toggle); toggle.title = 'Files and sections · b'; toggle.setAttribute('aria-label', 'Toggle documents'); toggle.onclick = () => openPanel('files', true);
  const appearanceButton = select('#appearance'); appearanceButton.innerHTML = glyph('appearance'); appearanceButton.title = 'Appearance';
  const jump = button('search-jump', 'Search or jump · Ctrl/Cmd+P', 'search', () => showMenu('Search or jump', [['Quick open · Ctrl/Cmd+P', quickOpen], ['Commands · Ctrl/Cmd+K', () => select('#commands-open').click()]]));
  const overflow = button('overflow', 'More actions', 'more', () => showMenu('Document actions', [['Export HTML', () => select('#export-document').click()], ['Print', () => select('#print').click()], ['Copy reference', () => select('#copy-reference').click()], ['History and navigation', () => select('#navigate-menu').click()], ['Trail', () => select('#trail-list').click()], ['Commands and keyboard map · Ctrl/Cmd+K', () => select('#commands-open').click()], ['Compare', () => select('#compare-open').click()]]));
  const cluster = document.createElement('div'); cluster.className = 'page-actions'; cluster.append(jump, appearanceButton, select('#toctog'), overflow); header.append(cluster);
  select('#toctog').innerHTML = glyph('outline'); select('#toctog').onclick = openOutline;
  select('.context').append(select('#trail-bar')); bank.append(select('#trail-list'));
  const headerSlot = document.createElement('div'); headerSlot.id = 'header-slot'; headerSlot.append(header); scroller.prepend(headerSlot);
  const right = document.createElement('aside'); right.id = 'right-panel'; right.setAttribute('aria-label', 'Page tools');
  const rightTabs = document.createElement('div'); rightTabs.className = 'right-tabs';
  for (const section of ['outline', 'notes', 'lists']) {
    const tab = document.createElement('button'); tab.textContent = section[0].toUpperCase() + section.slice(1); tab.dataset.right = section;
    tab.onclick = () => {
      select('#toc').hidden = section !== 'outline';
      rightTabs.querySelectorAll('[data-right]').forEach(item => item.setAttribute('aria-selected', String(item === tab)));
      if (section === 'outline') { for (const dialog of right.querySelectorAll('dialog[open]')) dialog.close(); }
      else { for (const dialog of right.querySelectorAll('dialog[open]')) dialog.close(); rightView = true; select(`#${section}-open`).click(); }
    }; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(section === 'outline')); rightTabs.append(tab);
  }
  rightTabs.setAttribute('role', 'tablist'); rightTabs.setAttribute('aria-label', 'Page tools');
  rightTabs.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const controls = [...rightTabs.querySelectorAll('[data-right]')], index = controls.indexOf(document.activeElement);
    controls[event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length]?.focus();
  };
  rightTabs.append(button('outline-close', 'Close outline', 'close', () => { right.classList.remove('open'); right.classList.add('collapsed'); right.removeAttribute('role'); right.removeAttribute('aria-modal'); returnFocus?.focus(); })); right.append(rightTabs, select('#toc')); select('.reading-area').append(right);
  const appearanceDialog = select('#appearance-dialog');
  appearanceDialog.insertBefore(select('#theme'), appearanceDialog.lastElementChild); appearanceDialog.insertBefore(select('#focus'), appearanceDialog.lastElementChild);
  select('#measure').min = '60'; select('#measure').max = '75';
  appearanceButton.onclick = () => showDialog(appearanceDialog);
  const focusAction = select('#focus').onclick;
  select('#focus').onclick = () => { appearanceDialog.close(); focusAction(); };
  const exit = document.createElement('button'); exit.id = 'exit-focus'; exit.textContent = 'Exit focus · Esc'; exit.onclick = () => setAppearance({ focus: false }); document.body.append(exit);
  const hint = document.createElement('div'); hint.id = 'first-hint'; hint.hidden = store.get('discovery-dismissed') === 'true';
  const hintText = document.createElement('span'); hintText.textContent = 'Search or jump opens files (Ctrl/Cmd+P). Commands (Ctrl/Cmd+K) lists every reader action.';
  const dismiss = document.createElement('button'); dismiss.textContent = 'Got it'; dismiss.onclick = () => { hint.hidden = true; store.set('discovery-dismissed', 'true'); }; hint.append(hintText, dismiss); headerSlot.after(hint);
  document.addEventListener('show-panel', event => {
    if (rightView) { rightView = false; const dialog = select(`#${event.detail}-dialog`); right.append(dialog); right.classList.add('open'); dialog.querySelector('[data-close-dialog]').onclick = () => { dialog.close(); rightTabs.querySelector('[data-right="outline"]').click(); }; }
    else openPanel(event.detail);
  });
  document.addEventListener('review-open-failed', () => { rightView = false; });
  document.addEventListener('reader-panel', event => openPanel(event.detail));
  select('#back-results').hidden = true;
  const status = document.createElement('p'); status.id = 'shell-status'; status.setAttribute('role', 'status'); nav.append(status);
  const statusObserver = new MutationObserver(() => { status.textContent = select('#review-tools .action-status')?.textContent || select('.nav-top > .action-status')?.textContent || ''; });
  statusObserver.observe(select('#review-tools'), { childList: true, subtree: true, characterData: true });
  statusObserver.observe(select('.nav-top'), { childList: true, subtree: true, characterData: true });
  document.addEventListener('workspace-loaded', () => { if (innerWidth < 1024) nav.classList.add('hide'); });
  nav.dataset.section = 'files'; selectAllRail('files');
  select('#search-view').hidden = true; if (innerWidth < 1024) nav.classList.add('hide');
  const revealHeader = () => { header.classList.add('revealed'); clearTimeout(header.hideTimer); header.hideTimer = setTimeout(() => { if (!header.contains(document.activeElement)) header.classList.remove('revealed'); }, 1800); };
  let lastScroll = 0;
  const headerGeometry = () => {
    const box = scroller.getBoundingClientRect();
    header.style.setProperty('--overlay-left', `${box.left}px`); header.style.setProperty('--overlay-width', `${scroller.clientWidth}px`);
    headerSlot.style.setProperty('--page-header-height', `${header.offsetHeight}px`);
    scroller.style.scrollPaddingTop = `${header.offsetHeight + 24}px`;
  };
  new ResizeObserver(headerGeometry).observe(scroller);
  new ResizeObserver(headerGeometry).observe(header);
  scroller.addEventListener('scroll', () => { if (scroller.scrollTop < lastScroll) revealHeader(); lastScroll = scroller.scrollTop; header.classList.toggle('past-header', scroller.scrollTop > 90); }, { passive: true });
  document.addEventListener('pointermove', event => { if (event.clientY < 20) revealHeader(); }, { passive: true });
  header.addEventListener('focusin', revealHeader);
  document.addEventListener('appearance-change', () => { if (appearance.focus) { header.classList.remove('revealed'); scroller.focus(); } });
  document.addEventListener('keydown', event => {
    if (select('dialog:modal')) return;
    if (event.key === 'Escape') {
      if (appearance.focus) { event.preventDefault(); setAppearance({ focus: false }); exit.blur(); }
      else if (innerWidth < 1280 && right.classList.contains('open')) select('#outline-close').click();
      else if (!nav.classList.contains('hide') && (innerWidth < 1024 || nav.contains(document.activeElement))) closePanel();
    }
    if (event.key === 'Tab') {
      const drawer = innerWidth < 1280 && right.classList.contains('open') ? right : innerWidth < 1024 && !nav.classList.contains('hide') ? nav : null;
      if (drawer) {
        const controls = [...drawer.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(element => element.getClientRects().length && !element.disabled);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
  });
  let narrow = innerWidth < 1024;
  addEventListener('resize', () => {
    const next = innerWidth < 1024;
    if (next !== narrow) { nav.classList.toggle('hide', next); narrow = next; }
    if (!next) { nav.removeAttribute('role'); nav.removeAttribute('aria-modal'); }
  });
  select('#list').addEventListener('focusin', event => {
    const target = event.target.closest('summary,a.f');
    if (target) select('#list').querySelectorAll('summary,a.f').forEach(element => element.tabIndex = element === target ? 0 : -1);
  });
  select('#list').addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const rows = [...select('#list').querySelectorAll('summary,a.f')].filter(element => element.getClientRects().length);
    const current = document.activeElement, index = rows.indexOf(current); if (index < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowRight' && current.tagName === 'SUMMARY') current.parentElement.open = true;
    else if (event.key === 'ArrowLeft' && current.tagName === 'SUMMARY') current.parentElement.open = false;
    else rows[event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    rows.forEach(element => element.tabIndex = element === document.activeElement ? 0 : -1);
  });
}
