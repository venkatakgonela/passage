import { select, selectAll, escapeHtml, toast } from './dom.js';
import { state } from './state.js';
import { hashPath, hashHeading, slug, resolvePath } from './paths.js';
import { markCurrent } from './tree.js';
import { renderDiagrams, cleanDiagrams } from './diagrams.js';
import { renderImages } from './media.js';
import { appearance, setAppearance } from './appearance.js';

let generation = 0;

function buildToc() {
  const headings = selectAll('#doc h2,#doc h3');
  const toc = select('#toc');
  if (state.observer) state.observer.disconnect();
  if (headings.length < 2) { toc.innerHTML = ''; return; }
  toc.innerHTML = '<h4>On this page</h4>' + headings.map(heading =>
    `<a class="${heading.tagName === 'H3' ? 'l3' : ''}" href="#${heading.id}" data-h="${heading.id}">${escapeHtml(heading.textContent.replace(/^#/, ''))}</a>`).join('');
  state.observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) selectAll('#toc a').forEach(anchor => anchor.classList.toggle('on', anchor.dataset.h === entry.target.id));
    }
  }, { root: select('#scroller'), rootMargin: '0px 0px -75% 0px' });
  headings.forEach(heading => state.observer.observe(heading));
}

export async function openDocument(preserve = false) {
  const path = hashPath();
  if (!path || !state.root) return;
  if (path === state.currentPath && preserve !== true && select('#doc').dataset.ready === 'true') {
    document.getElementById(hashHeading())?.scrollIntoView({ block: 'start', behavior: 'instant' });
    document.dispatchEvent(new Event('document-ready'));
    return;
  }
  const current = ++generation;
  const oldScroll = select('#scroller').scrollTop;
  const themeAnchor = preserve === true ? [...selectAll('#doc h1,#doc h2,#doc h3,#doc h4')].find(element => element.getBoundingClientRect().top >= select('#scroller').getBoundingClientRect().top) : null;
  const themeOffset = themeAnchor?.getBoundingClientRect().top;
  const themeId = themeAnchor?.id;
  select('#doc').dataset.ready = 'false';
  cleanDiagrams(select('#doc'));
  state.currentPath = path;
  markCurrent();
  const response = await fetch(`/api/file?root=${state.root}&path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    select('#doc').innerHTML = '<p class="empty">File not found.</p>';
    select('#toc').innerHTML = '';
    select('#doc').dataset.ready = 'true';
    return;
  }
  const text = await response.text();
  if (current !== generation) return;
  const documentBody = select('#doc');
  const rendering = renderArticle(documentBody, text, path);
  const heading = documentBody.querySelector('h1');
  document.title = heading ? heading.textContent.replace(/^#/, '') : path;
  select('#crumb').innerHTML = path.split('/').map((part, index, parts) => index === parts.length - 1 ? `<b>${escapeHtml(part)}</b>` : escapeHtml(part)).join(' <span style="opacity:.5">/</span> ');
  buildToc();
  if (preserve !== true) select('#scroller').scrollTo({ top: 0, behavior: 'instant' });
  await rendering;
  if (current !== generation) return;
  documentBody.dataset.ready = 'true';
  if (preserve === true) {
    select('#scroller').scrollTo({ top: oldScroll, behavior: 'instant' });
    const anchor = document.getElementById(themeId);
    if (anchor) select('#scroller').scrollTop += anchor.getBoundingClientRect().top - themeOffset;
  }
  else if (hashHeading()) document.getElementById(hashHeading())?.scrollIntoView({ block: 'start', behavior: 'instant' });
  document.dispatchEvent(new Event('document-ready'));
}

export async function renderArticle(documentBody, text, path, prefix = '') {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true }));
  template.content.querySelectorAll('img').forEach(image => {
    image.dataset.originalSource = image.getAttribute('src') || '';
    image.removeAttribute('src');
  });
  documentBody.replaceChildren(template.content);
  const words = (text.match(/\S+/g) || []).length;
  documentBody.insertAdjacentHTML('afterbegin', `<p class="meta">${escapeHtml(path.split('/').slice(0, -1).join(' / ') || 'Workspace')} · ${words.toLocaleString()} words · ${Math.max(1, Math.round(words / 220))} min read</p>`);
  const used = new Set();
  documentBody.querySelectorAll('h1,h2,h3,h4').forEach(heading => {
    heading.id = prefix + slug(heading.textContent, used);
    heading.insertAdjacentHTML('afterbegin', `<a class="a" href="#${heading.id}" data-h="${heading.id}" aria-label="Link to section">#</a>`);
  });
  documentBody.querySelectorAll('table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tw';
    wrapper.dataset.scrollRegion = 'table';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('aria-label', 'Table. Scroll horizontally for more columns.');
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
    const hint = document.createElement('p');
    hint.className = 'scroll-hint';
    hint.textContent = 'Scroll table horizontally for more columns →';
    wrapper.after(hint);
  });
  documentBody.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (code?.classList.contains('language-mermaid')) return;
    if (code) hljs.highlightElement(code);
    const frame = document.createElement('div');
    frame.className = 'code-frame';
    const toolbar = document.createElement('div');
    toolbar.className = 'media-toolbar';
    const label = document.createElement('span');
    label.textContent = code?.className.match(/language-(\S+)/)?.[1] || 'text';
    pre.replaceWith(frame);
    frame.append(toolbar, pre);
    pre.dataset.scrollRegion = 'code';
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', 'Code. Scroll horizontally or use Wrap.');
    const button = document.createElement('button');
    button.className = 'copy';
    button.textContent = 'Copy';
    button.onclick = async () => { await navigator.clipboard.writeText(code ? code.innerText : pre.innerText); toast('Copied'); };
    const wrap = document.createElement('button');
    wrap.textContent = 'Wrap';
    wrap.onclick = () => setAppearance({ wrap: !appearance.wrap });
    toolbar.append(label, wrap, button);
    const hint = document.createElement('p');
    hint.className = 'scroll-hint';
    hint.textContent = 'Scroll code horizontally or choose Wrap →';
    frame.append(hint);
  });
  documentBody.querySelectorAll('input[type=checkbox]').forEach(checkbox => { checkbox.disabled = true; });
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  documentBody.querySelectorAll('a[href]').forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (anchor.dataset.h) return;
    if (/^https?:/i.test(href)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
    else if (href.startsWith('#')) anchor.dataset.h = href.slice(1);
    else if (!/^[a-z]+:/i.test(href)) {
      const [relative, fragment] = href.split('#');
      if (/\.md$/i.test(relative)) {
        anchor.dataset.md = resolvePath(directory, decodeURI(relative));
        if (fragment) anchor.dataset.frag = fragment;
        anchor.href = '#' + encodeURIComponent(anchor.dataset.md);
      }
    }
  });
  await Promise.all([renderDiagrams(documentBody), renderImages(documentBody, path)]);
}
