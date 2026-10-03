import { escapeHtml } from './dom.js';

export function frontMatter(text) {
  const match = /^---\r?\n([\s\S]{0,16384}?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return { text, fields: [] };
  const fields = match[1].split('\n').slice(0, 100).map(line => {
    const separator = line.indexOf(':');
    return separator < 0 ? [line.trim(), ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });
  return { text: text.slice(match[0].length), fields };
}

export function prepareMarkdown(text, prefix = '') {
  const front = frontMatter(text);
  const definitions = new Map();
  const math = [];
  let fenced = false;
  const lines = front.text.split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced || /^\s*(```|~~~)/.test(line) || /^ {4}/.test(line)) return line;
    const definition = /^\[\^([\w-]{1,60})\]:\s*(.*)$/.exec(line);
    if (definition && definitions.size < 100) { definitions.set(definition[1], definition[2]); return ''; }
    return line;
  });
  let body = lines.join('\n').replace(/(```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`[^`\n]*`)|\$\$([\s\S]*?)\$\$|(?<![\\\w])\$([^$\n]+)\$/g, (raw, code, display, inline) => {
    if (code || math.length >= 200) return raw;
    const index = math.length; math.push({ source: display ?? inline, display: display !== undefined });
    return `<span data-math-slot="${index}"></span>`;
  });
  const references = new Map();
  body = body.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)|\[\^([\w-]{1,60})\]/g, (raw, code, key) => {
    if (code || !definitions.has(key)) return raw;
    const occurrence = (references.get(key) || 0) + 1; references.set(key, occurrence);
    return `<sup id="${prefix}ref-${key}-${occurrence}"><a href="#${prefix}note-${key}">[${escapeHtml(key)}]</a></sup>`;
  });
  const notes = [...references].map(([key, count]) => `<li id="${prefix}note-${key}">${escapeHtml(definitions.get(key))} ${Array.from({ length: count }, (unused, index) => `<a href="#${prefix}ref-${key}-${index + 1}" aria-label="Return to reference ${index + 1}">↩</a>`).join(' ')}</li>`).join('');
  return { body, math, fields: front.fields, notes: notes ? `<section class="footnotes" aria-label="Footnotes"><ol>${notes}</ol></section>` : '' };
}

let loading;
function loadMath() {
  if (globalThis.katex) return Promise.resolve(globalThis.katex);
  if (!loading) loading = new Promise((accept, reject) => {
    const script = document.createElement('script'); script.src = '/vendor/katex.min.js';
    script.onload = () => accept(globalThis.katex);
    script.onerror = () => { loading = null; script.remove(); reject(new Error('Math renderer unavailable; reload to retry')); };
    document.head.append(script);
  });
  return loading;
}

export async function decorateExtensions(container, prepared) {
  if (prepared.fields.length) {
    const panel = document.createElement('details'); panel.className = 'front-matter';
    const summary = document.createElement('summary'); summary.textContent = 'Document metadata'; panel.append(summary);
    const list = document.createElement('dl');
    for (const [key, value] of prepared.fields) {
      const term = document.createElement('dt'), definition = document.createElement('dd');
      term.textContent = key; definition.textContent = value; list.append(term, definition);
    }
    panel.append(list); container.prepend(panel);
  }
  container.querySelectorAll('blockquote').forEach(quote => {
    const paragraph = quote.querySelector('p');
    const match = /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/.exec(paragraph?.textContent || '');
    if (!match) return;
    quote.classList.add('callout');
    const label = document.createElement('strong'); label.textContent = match[1];
    paragraph.prepend(label, document.createElement('br'));
  });
  if (!prepared.math.length) return;
  let renderer;
  try { renderer = await loadMath(); } catch {}
  for (const element of container.querySelectorAll('[data-math-slot]')) {
    const expression = prepared.math[Number(element.dataset.mathSlot)];
    if (!expression) { element.removeAttribute('data-math-slot'); continue; }
    element.className = expression.display ? 'math-block' : 'math-inline';
    element.dataset.scrollRegion = 'math'; element.tabIndex = 0;
    element.setAttribute('aria-label', 'Equation. Scroll horizontally if needed.');
    const hint = document.createElement('span'); hint.className = 'scroll-hint'; hint.textContent = 'Scroll equation horizontally if needed'; element.after(hint);
    try {
      if (!renderer || expression.source.length > 4000 || /\\(?:href|url|includegraphics|html\w*|def|gdef|edef|xdef|newcommand)\b/.test(expression.source)) throw new Error('Unsupported or unavailable math');
      const output = renderer.renderToString(expression.source, { output: 'mathml', displayMode: expression.display, trust: false, strict: 'error', maxExpand: 100, maxSize: 20, throwOnError: true });
      element.innerHTML = DOMPurify.sanitize(output);
    } catch {
      element.textContent = `Math unavailable or invalid — source: ${expression.source}`;
      element.classList.add('math-error');
    }
  }
}
