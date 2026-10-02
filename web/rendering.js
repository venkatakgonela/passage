import { select, selectAll, escapeHtml, toast } from './dom.js';
import { state } from './state.js';
import { hashPath, slug, resolvePath } from './paths.js';
import { markCurrent } from './tree.js';

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

export async function openDocument() {
  const path = hashPath();
  if (!path || !state.root) return;
  state.currentPath = path;
  markCurrent();
  const response = await fetch(`/api/file?root=${state.root}&path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    select('#doc').innerHTML = '<p class="empty">File not found.</p>';
    select('#toc').innerHTML = '';
    return;
  }
  const text = await response.text();
  const documentBody = select('#doc');
  documentBody.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true }));
  const words = (text.match(/\S+/g) || []).length;
  documentBody.insertAdjacentHTML('afterbegin', `<p class="meta">${escapeHtml(path.split('/').slice(0, -1).join(' / ') || '/')} · ${words.toLocaleString()} words · ${Math.max(1, Math.round(words / 220))} min read</p>`);
  const used = new Set();
  selectAll('#doc h1,#doc h2,#doc h3,#doc h4').forEach(heading => {
    heading.id = slug(heading.textContent, used);
    heading.insertAdjacentHTML('afterbegin', `<a class="a" href="#${heading.id}" data-h="${heading.id}" aria-label="Link to section">#</a>`);
  });
  selectAll('#doc table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tw';
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  });
  selectAll('#doc pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (code) hljs.highlightElement(code);
    const button = document.createElement('button');
    button.className = 'copy';
    button.textContent = 'Copy';
    button.onclick = async () => { await navigator.clipboard.writeText(code ? code.innerText : pre.innerText); toast('Copied'); };
    pre.appendChild(button);
  });
  selectAll('#doc input[type=checkbox]').forEach(checkbox => { checkbox.disabled = true; });
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  selectAll('#doc a[href]').forEach(anchor => {
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
  selectAll('#doc img').forEach(image => {
    if (!/^(https?:|data:)/i.test(image.getAttribute('src') || '')) {
      image.replaceWith(Object.assign(document.createElement('em'), { textContent: `[image: ${image.alt || image.getAttribute('src')}]` }));
    }
  });
  const heading = documentBody.querySelector('h1');
  document.title = heading ? heading.textContent.replace(/^#/, '') : path;
  select('#crumb').innerHTML = path.split('/').map((part, index, parts) => index === parts.length - 1 ? `<b>${escapeHtml(part)}</b>` : escapeHtml(part)).join(' <span style="opacity:.5">/</span> ');
  buildToc();
  select('#scroller').scrollTo(0, 0);
}
