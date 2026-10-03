export function setupAppearancePopover() {
  const panel = document.querySelector('#appearance-dialog');
  let trigger;
  const position = () => {
    if (!panel.open) return;
    const bounds = trigger.getBoundingClientRect();
    const left = trigger.id === 'rail-appearance' ? bounds.right + 8 : bounds.right - panel.offsetWidth;
    panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, left))}px`;
    panel.style.top = `${Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, bounds.bottom + 8))}px`;
  };
  const close = () => { if (panel.open) panel.close(); };
  for (const button of document.querySelectorAll('#appearance,#rail-appearance')) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.onclick = () => {
      if (panel.open) { close(); return; }
      trigger = button;
      panel.show();
      position();
      trigger.setAttribute('aria-expanded', 'true');
      panel.querySelector('input:checked').focus();
    };
  }
  panel.addEventListener('close', () => { trigger?.setAttribute('aria-expanded', 'false'); trigger?.focus(); });
  document.querySelector('#appearance-close').onclick = close;
  document.addEventListener('pointerdown', event => { if (panel.open && !panel.contains(event.target) && !trigger.contains(event.target)) { event.preventDefault(); close(); } });
  document.addEventListener('keydown', event => {
    if (!panel.open) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    else if (panel.contains(event.target)) event.stopPropagation();
  }, true);
  addEventListener('resize', position);
  new ResizeObserver(position).observe(panel);
}
