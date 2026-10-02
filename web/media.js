import { state } from './state.js';
import { resolvePath } from './paths.js';
import { stableChange } from './layout.js';

export function enlarge(element, title) {
  const previous = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'media-dialog';
  dialog.setAttribute('aria-label', title);
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.onclick = () => dialog.close();
  dialog.append(close, element);
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); });
  dialog.showModal();
  close.focus();
}

export async function renderImages(container, path) {
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  await Promise.all([...container.querySelectorAll('img')].map(async image => {
    const source = image.dataset.originalSource || image.getAttribute('src') || '';
    const frame = document.createElement('figure');
    frame.className = 'image-frame';
    frame.style.height = '420px';
    frame.style.display = 'flex';
    frame.style.flexDirection = 'column';
    image.style.maxHeight = '350px';
    image.style.minHeight = '0';
    image.replaceWith(frame);
    const label = image.alt || 'Image';
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    frame.append(image, caption);
    image.loading = 'eager';
    image.onerror = () => stableChange(() => { image.remove(); caption.textContent = `${label} — image unavailable or unsupported`; frame.classList.add('failed'); });
    if (!/^(https?:|data:)/i.test(source)) {
      try {
        const relative = resolvePath(directory, decodeURIComponent(source));
        const query = new URLSearchParams({ root: state.root, path: relative });
        const response = await fetch(`/api/image-info?${query}`);
        if (!response.ok) throw new Error('Image unavailable');
        const info = await response.json();
        stableChange(() => {
          image.width = info.width;
          image.height = info.height;
          image.src = `/api/image?${query}`;
        });
      } catch { image.onerror(); return; }
    } else image.src = source;
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Enlarge ${label}`);
    const open = () => {
      const enlarged = image.cloneNode();
      enlarged.removeAttribute('role');
      enlarged.removeAttribute('tabindex');
      enlarged.removeAttribute('aria-label');
      enlarged.style.maxHeight = 'none';
      enlarge(enlarged, label);
    };
    image.onclick = open;
    image.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
  }));
}
