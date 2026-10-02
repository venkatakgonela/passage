import { select, toast } from './dom.js';
import { state } from './state.js';
import { hashPath } from './paths.js';
import { renderList } from './tree.js';
import { openDocument } from './rendering.js';

function goHeading(identifier) {
  const element = document.getElementById(identifier);
  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function setupNavigation() {
  select('#navtog').onclick = () => select('#nav').classList.toggle('hide');
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    if (anchor.dataset.h !== undefined && anchor.closest('article,aside')) {
      event.preventDefault(); goHeading(anchor.dataset.h); return;
    }
    if (anchor.dataset.md) {
      event.preventDefault();
      const fragment = anchor.dataset.frag;
      const go = () => fragment && setTimeout(() => goHeading(fragment), 200);
      if (state.files.includes(anchor.dataset.md)) {
        if (hashPath() === anchor.dataset.md) go();
        else { location.hash = encodeURIComponent(anchor.dataset.md); go(); }
      } else toast(`Not in this folder: ${anchor.dataset.md}`);
    }
    if (anchor.matches('#list a.f') && innerWidth <= 820) select('#nav').classList.add('hide');
  });
  addEventListener('hashchange', openDocument);
  addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault(); select('#nav').classList.remove('hide'); select('#q').focus(); select('#q').select();
    } else if (event.key === 'Escape' && document.activeElement === select('#q')) {
      select('#q').value = ''; state.searchSequence++; renderList(); select('#q').blur();
    } else if (event.key === 'b' && !typing && !event.metaKey && !event.ctrlKey) select('#nav').classList.toggle('hide');
  });
  let narrow = innerWidth <= 820;
  select('#nav').classList.toggle('hide', narrow);
  addEventListener('resize', () => {
    const next = innerWidth <= 820;
    if (next !== narrow) { narrow = next; select('#nav').classList.toggle('hide', next); }
  });
}
