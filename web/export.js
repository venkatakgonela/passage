import { state } from './state.js';
import { resolvePath } from './paths.js';

export const EXPORT_LIMIT = 8 * 1024 * 1024;

export function exportMarkup(markup) {
  return DOMPurify.sanitize(markup, { FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base', 'style', 'svg'], FORBID_ATTR: ['srcset', 'action', 'formaction', 'style'] });
}

export async function buildExport(container, path, root = state.root) {
  const clone = container.cloneNode(true);
  clone.querySelectorAll('button,.media-toolbar,.scroll-hint,.meta').forEach(element => element.remove());
  clone.querySelectorAll('.diagram-shell').forEach(shell => {
    const placeholder = document.createElement('pre');
    placeholder.textContent = `Diagram (static export placeholder)\n${shell.dataset.source || shell.querySelector('code')?.textContent || 'Source unavailable'}`;
    shell.replaceWith(placeholder);
  });
  let bytes = new TextEncoder().encode(clone.textContent).length;
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  for (const image of clone.querySelectorAll('img')) {
    const source = image.dataset.originalSource || '';
    try {
      if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) throw new Error('Non-workspace image');
      const relative = resolvePath(directory, decodeURIComponent(source));
      const response = await fetch(`/api/image?${new URLSearchParams({ root, path: relative })}`);
      if (!response.ok || !['image/png', 'image/jpeg'].includes(response.headers.get('Content-Type'))) throw new Error('Image rejected');
      const blob = await response.blob(); bytes += Math.ceil(blob.size * 4 / 3);
      if (bytes > EXPORT_LIMIT) throw new Error('Export image budget exceeded');
      image.src = await new Promise((accept, reject) => { const reader = new FileReader(); reader.onload = () => accept(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      image.removeAttribute('data-original-source');
    } catch {
      const placeholder = document.createElement('p'); placeholder.textContent = `Image omitted: ${image.alt || 'unavailable or outside export limits'}`; image.replaceWith(placeholder);
    }
  }
  clone.querySelectorAll('a').forEach(anchor => { if (!anchor.getAttribute('href')?.startsWith('#')) anchor.removeAttribute('href'); });
  clone.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) if (attribute.name.startsWith('data-') || attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
  });
  const styles = [];
  for (const pathname of ['/styles.css', '/release.css']) {
    const response = await fetch(pathname); if (!response.ok) throw new Error('Export styles unavailable; reconnect and retry');
    styles.push(await response.text());
  }
  const clean = exportMarkup(clone.innerHTML);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Exported document</title><style>${styles.join('\n')}body{height:auto;display:block;padding:24px}article{margin:auto;max-width:90ch}.tw{overflow:auto}pre{white-space:pre-wrap}details{display:block}</style></head><body><article>${clean}</article></body></html>`;
  if (new TextEncoder().encode(html).length > EXPORT_LIMIT) throw new Error('Export exceeds 8 MiB; use browser print instead');
  return html;
}

export async function downloadExport() {
  const html = await buildExport(document.querySelector('#doc'), state.currentPath);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = state.currentPath.split('/').at(-1).replace(/\.md$/, '') + '.html'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
