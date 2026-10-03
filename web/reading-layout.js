import { appearance } from './appearance.js';
import { stableChange } from './layout.js';

function intrinsicWidth(block) {
  if (block.matches('.diagram-shell')) return Number(block.dataset.intrinsicWidth) || 0;
  if (block.matches('.image-frame')) return block.querySelector('img')?.width || 0;
  const content = block.querySelector('pre,table,math') || block;
  const previous = content.style.cssText;
  content.style.width = 'max-content';
  content.style.maxWidth = 'none';
  content.style.whiteSpace = 'pre';
  const width = Math.max(content.scrollWidth, content.getBoundingClientRect().width);
  content.style.cssText = previous;
  return width;
}

export function setupReadingLayout() {
  const article = document.querySelector('#doc');
  let scheduled = false;
  const update = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      stableChange(() => {
        const measure = appearance.fill ? article.clientWidth : Math.min(article.clientWidth, appearance.measure * appearance.fs / 2);
        for (const block of article.querySelectorAll('.code-frame,.tw,.diagram-shell,.image-frame,.math-block')) {
          const parent = block.parentElement;
          const standalone = parent.tagName === 'P' && [...parent.childNodes].every(node => node.nodeType !== Node.TEXT_NODE || !node.textContent.trim());
          const target = standalone ? parent : block;
          target.classList.add('technical-block');
          target.classList.toggle('wide-block', intrinsicWidth(block) > measure + 1);
        }
      });
    });
  };
  new ResizeObserver(update).observe(article);
  document.addEventListener('document-ready', update);
  document.addEventListener('appearance-change', update);
}
