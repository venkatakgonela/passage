import { enlarge } from './media.js';
import { stableChange } from './layout.js';

let library;
let serial = Promise.resolve();
let identifier = 0;

function loadLibrary() {
  return library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/mermaid.min.js';
    script.onload = () => resolve(window.mermaid);
    script.onerror = () => { library = null; reject(new Error('Diagram library could not load')); };
    document.head.append(script);
  });
}

function diagramStatements(source, sequence) {
  const entity = /^\s*erDiagram\b/.test(source);
  const statements = [];
  let statement = '';
  let quote = false;
  let depth = 0;
  let resource = false;
  let message = false;
  for (let position = 0; position < source.length; position++) {
    const character = source[position];
    if (quote) {
      if (character === '"' && source[position - 1] !== '\\') quote = false;
      continue;
    }
    if (character === '"') { quote = true; statement += '""'; continue; }
    if (!depth && source.startsWith('%%', position)) {
      if (source.startsWith('%%{', position)) throw new Error('Document configuration is not allowed in diagrams');
      const end = source.indexOf('\n', position);
      position = end < 0 ? source.length : end - 1;
      continue;
    }
    const cardinality = entity && '{}'.includes(character) && /[|o.-]/.test((source[position - 1] || '') + (source[position + 1] || ''));
    if (!sequence && !cardinality && '[({'.includes(character)) {
      if (!depth) resource = character === '{' && source[position - 1] === '@';
      depth++;
    }
    if (!depth && (character === '\n' || character === ';')) {
      statements.push(statement.trim()); statement = ''; message = false; continue;
    }
    if (sequence && character === ':' && !/^\s*links?\s/i.test(statement)) message = true;
    if ((!depth || resource) && !message) statement += character;
    if (!sequence && !cardinality && '])}'.includes(character) && depth) depth--;
  }
  if (quote || depth) throw new Error('Unterminated diagram quote or bracket');
  statements.push(statement.trim());
  return statements;
}

export function validateDiagram(source) {
  if (source.length > 50000 || source.split('\n').length > 500) throw new Error('Diagram exceeds the 50,000-character / 500-line limit');
  if (/^\s*---(?:\s|$)/.test(source)) throw new Error('Document configuration is not allowed in diagrams');
  const statements = diagramStatements(source, /^\s*sequenceDiagram\b/.test(source));
  if (statements.some(statement => /^(?:click|style|classDef|linkStyle|link|links)\s+(?![-=<>~])[\w]/i.test(statement) || /@\{[^}]*\b(?:img|icon)\s*:/.test(statement))) throw new Error('Document links, images and custom styles are not allowed in diagrams');
  if (!/^\s*(flowchart|graph|sequenceDiagram|erDiagram)\b/.test(source)) throw new Error('Supported diagrams: flowchart, sequence and ER');
}

function button(label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.onclick = action;
  return element;
}

async function renderOne(code) {
  const source = code.textContent;
  const shell = document.createElement('section');
  shell.className = 'diagram-shell';
  shell.dataset.diagram = 'loading';
  shell.setAttribute('aria-label', 'Diagram');
  const toolbar = document.createElement('div');
  toolbar.className = 'media-toolbar';
  const viewport = document.createElement('div');
  viewport.className = 'diagram-viewport';
  viewport.dataset.scrollRegion = 'diagram';
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', 'Diagram canvas. Arrow keys pan; use zoom controls to enlarge.');
  const hint = document.createElement('p');
  hint.className = 'scroll-hint';
  hint.textContent = 'Loading diagram…';
  const sourceView = document.createElement('pre');
  sourceView.className = 'diagram-source';
  sourceView.textContent = source;
  sourceView.hidden = true;
  shell.append(toolbar, viewport, hint, sourceView);
  stableChange(() => code.parentElement.replaceWith(shell));
  try {
    validateDiagram(source);
    const mermaid = await loadLibrary();
    const dark = document.documentElement.dataset.theme === 'dark';
    mermaid.initialize({ startOnLoad: false, securityLevel: 'sandbox', htmlLabels: false, flowchart: { htmlLabels: false }, theme: 'base', themeVariables: { darkMode: dark, primaryColor: dark ? '#344b38' : '#dfe9dd', primaryTextColor: dark ? '#eceee5' : '#292c27', primaryBorderColor: dark ? '#b5d7a9' : '#336148', lineColor: dark ? '#b5d7a9' : '#336148', background: dark ? '#222a25' : '#fffdf8', fontFamily: 'Arial, sans-serif' }, maxTextSize: 50000, maxEdges: 300, suppressErrorRendering: true });
    const rendered = await mermaid.render(`passage-diagram-${++identifier}`, source);
    const envelope = new DOMParser().parseFromString(rendered.svg, 'text/html');
    const returned = envelope.querySelector('iframe');
    if (!returned?.src.startsWith('data:text/html;charset=UTF-8;base64,')) throw new Error('Unexpected sandbox output');
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(returned.src.split(',')[1]), character => character.charCodeAt(0)));
    const parsed = new DOMParser().parseFromString(decoded, 'text/html');
    const svg = parsed.querySelector('svg');
    const box = svg?.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
    if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) throw new Error('Invalid diagram dimensions');
    shell.dataset.intrinsicWidth = String(box[2]);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.maxWidth = 'none';
    const frame = document.createElement('iframe');
    frame.title = 'Rendered diagram';
    frame.setAttribute('sandbox', '');
    frame.tabIndex = -1;
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><body style="margin:0;background:${dark ? '#222a25' : '#fffdf8'}">${svg.outerHTML}</body>`;
    const surface = document.createElement('div');
    surface.className = 'diagram-surface';
    surface.append(frame);
    viewport.append(surface);
    let scale = 1;
    const fullscreen = () => Boolean(shell.closest('dialog[open]'));
    const fitScale = () => fullscreen()
      ? Math.min(4, Math.max(1, viewport.clientWidth - 24) / box[2], Math.max(1, viewport.clientHeight - 24) / box[3])
      : Math.min(1, Math.max(100, viewport.clientWidth - 24) / box[2], 350 / box[3]);
    const apply = () => { frame.style.width = `${box[2] * scale}px`; frame.style.height = `${box[3] * scale}px`; surface.style.width = `${Math.max(viewport.clientWidth - 24, box[2] * scale)}px`; };
    const fit = () => { scale = fitScale(); apply(); viewport.scrollTo(0, 0); };
    toolbar.append(button('Zoom in', () => { scale = Math.min(4, scale * 1.4); apply(); }), button('Zoom out', () => { scale = Math.max(.02, scale / 1.4); apply(); }), button('Fit', fit), button('Reset', fit), button('Fullscreen', () => {
      if (fullscreen()) return;
      const placeholder = document.createElement('div');
      const inlineHeight = shell.getBoundingClientRect().height;
      placeholder.style.height = `${inlineHeight}px`;
      placeholder.style.margin = getComputedStyle(shell).margin;
      const scroller = document.querySelector('#scroller');
      const scroll = scroller.scrollTop;
      const overflow = scroller.style.overflow;
      const sourceWasOpen = !sourceView.hidden;
      const inlineViewportHeight = viewport.style.height;
      shell.before(placeholder);
      const dialog = enlarge(shell, 'Fullscreen diagram', () => {
        shell.append(sourceView);
        sourceView.hidden = !sourceWasOpen;
        viewport.classList.remove('show-source');
        viewport.style.height = inlineViewportHeight;
        placeholder.replaceWith(shell);
        scroller.style.overflow = overflow;
        scroller.scrollTop = scroll;
        fit();
      });
      dialog.classList.add('diagram-dialog');
      viewport.style.height = '';
      viewport.append(sourceView);
      viewport.classList.toggle('show-source', !sourceView.hidden);
      scroller.style.overflow = 'hidden';
      fit();
    }), button('Source', () => { sourceView.hidden = !sourceView.hidden; viewport.classList.toggle('show-source', fullscreen() && !sourceView.hidden); if (fullscreen() && sourceView.hidden) fit(); }), button('Copy source', async () => { await navigator.clipboard.writeText(source); hint.textContent = 'Source copied. Scroll or drag to pan.'; }));
    let drag;
    viewport.onpointerdown = event => { drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }; viewport.setPointerCapture(event.pointerId); };
    viewport.onpointermove = event => { if (drag) { viewport.scrollLeft = drag.left + drag.x - event.clientX; viewport.scrollTop = drag.top + drag.y - event.clientY; } };
    viewport.onpointerup = viewport.onpointercancel = () => { drag = null; };
    viewport.onkeydown = event => { const delta = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key]; if (delta) { event.preventDefault(); viewport.scrollBy(...delta); } };
    const observer = new ResizeObserver(() => { if (shell.isConnected && (fullscreen() || scale <= fitScale() * 1.05)) fit(); });
    observer.observe(viewport);
    shell.cleanup = () => observer.disconnect();
    shell.fit = fit;
    shell.dataset.source = source;
    stableChange(() => { viewport.style.height = `${Math.max(150, Math.min(380, box[3] + 24))}px`; fit(); });
    shell.dataset.diagram = 'ready';
    hint.textContent = 'Zoom for detail · scroll or drag to pan · arrow keys supported';
  } catch (error) {
    shell.dataset.diagram = 'error';
    viewport.textContent = `Diagram could not render: ${error.message}`;
    sourceView.hidden = false;
    hint.textContent = 'Original source is shown below.';
  }
}

export async function renderDiagrams(container) {
  for (const code of [...container.querySelectorAll('pre > code.language-mermaid')]) {
    serial = serial.catch(() => {}).then(() => renderOne(code));
    await serial;
  }
}

export function cleanDiagrams(container) {
  container.querySelectorAll('.diagram-shell').forEach(shell => shell.cleanup?.());
}

if (typeof window !== 'undefined') window.addEventListener('beforeprint', () => document.querySelectorAll('.diagram-shell').forEach(shell => shell.fit?.()));
