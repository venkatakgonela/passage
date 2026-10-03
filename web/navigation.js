import { select, toast } from './dom.js';
import { state } from './state.js';
import { hashPath, documentHash } from './paths.js';
import { renderList } from './tree.js';
import { openDocument } from './rendering.js';

export function setupNavigation() {
  let activeDrawer = null;
  let drawerTrigger = null;
  const closeDrawer = () => {
    if (!activeDrawer) return;
    if (activeDrawer.id === 'nav') activeDrawer.classList.add('hide');
    else activeDrawer.classList.remove('drawer-open');
    activeDrawer.removeAttribute('role');
    activeDrawer.removeAttribute('aria-modal');
    activeDrawer = null;
    drawerTrigger?.focus();
  };
  const toggleDrawer = (panel, trigger) => {
    if (activeDrawer === panel) { closeDrawer(); return; }
    closeDrawer();
    panel.classList.remove('hide');
    if (panel.id === 'toc') panel.classList.add('drawer-open');
    activeDrawer = panel;
    drawerTrigger = trigger;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', panel.id === 'nav' ? 'Documents drawer' : 'Outline drawer');
    let close = panel.querySelector('.drawer-close');
    if (!close) { close = document.createElement('button'); close.className = 'drawer-close'; close.textContent = 'Close panel'; panel.prepend(close); }
    close.onclick = closeDrawer;
    close.focus();
  };
  select('#navtog').onclick = () => innerWidth <= 820 ? toggleDrawer(select('#nav'), select('#navtog')) : select('#nav').classList.toggle('hide');
  select('#toctog').onclick = () => toggleDrawer(select('#toc'), select('#toctog'));
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    if (anchor.dataset.h !== undefined && anchor.closest('article,aside')) {
      event.preventDefault(); location.hash = documentHash(hashPath(), anchor.dataset.h); closeDrawer(); return;
    }
    if (anchor.dataset.md) {
      event.preventDefault();
      const fragment = anchor.dataset.frag;
      if (state.files.includes(anchor.dataset.md)) {
        location.hash = documentHash(anchor.dataset.md, fragment);
      } else toast(`Not in this folder: ${anchor.dataset.md}`);
    }
    if (anchor.matches('#list a.f') && innerWidth <= 820) closeDrawer();
  });
  addEventListener('hashchange', openDocument);
  document.addEventListener('reader-theme-change', () => openDocument(true));
  addEventListener('keydown', event => {
    if (document.body.classList.contains('reader-shell')) {
      if (select('dialog:modal')) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (event.key === '/' && !typing) { event.preventDefault(); document.dispatchEvent(new CustomEvent('reader-panel', { detail: 'search' })); }
      else if (event.key === 'b' && !typing && !event.metaKey && !event.ctrlKey) select('#navtog').click();
      return;
    }
    if (activeDrawer && event.key === 'Tab') {
      const controls = [...activeDrawer.querySelectorAll('button,a[href],input,select')].filter(element => element.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault(); if (innerWidth <= 820 && activeDrawer !== select('#nav')) toggleDrawer(select('#nav'), select('#navtog')); else select('#nav').classList.remove('hide'); select('#q').focus(); select('#q').select();
    } else if (event.key === 'Escape' && document.activeElement === select('#q')) {
      select('#q').value = ''; state.searchSequence++; renderList(); select('#q').blur();
    } else if (event.key === 'b' && !typing && !event.metaKey && !event.ctrlKey) select('#navtog').click();
    else if (event.key === 'Escape') { closeDrawer(); }
  });
  let narrow = innerWidth <= 820;
  select('#nav').classList.toggle('hide', narrow);
  addEventListener('resize', () => {
    if (document.body.classList.contains('reader-shell')) return;
    const next = innerWidth <= 820;
    if (next !== narrow) { narrow = next; select('#nav').classList.toggle('hide', next && activeDrawer !== select('#nav')); }
  });
}
