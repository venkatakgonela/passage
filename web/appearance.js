import { store } from './state.js';

export const DEFAULTS = { theme: 'auto', fs: 18, measure: 80, fill: true, font: 'serif', focus: false, wrap: false };
export function normalizeAppearance(value) {
  return {
    theme: ['auto', 'light', 'dark'].includes(value.theme) ? value.theme : 'auto',
    fs: Number.isFinite(+value.fs) ? Math.min(24, Math.max(13, +value.fs)) : 18,
    measure: Number.isFinite(+value.measure) ? Math.min(140, Math.max(60, +value.measure)) : 80,
    fill: value.fill === undefined ? DEFAULTS.fill : value.fill === true,
    font: value.font === 'sans' ? 'sans' : 'serif',
    focus: value.focus === true,
    wrap: value.wrap === true,
  };
}
let stored = {};
try { stored = JSON.parse(store.get('appearance') || '{}'); } catch {}
if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
if (!store.get('appearance')) {
  const theme = store.get('theme');
  const size = store.get('fs');
  if (theme) stored.theme = theme;
  if (size) stored.fs = +size;
}
export let appearance = normalizeAppearance({ ...DEFAULTS, ...stored });
export function setAppearance(values) {
  appearance = normalizeAppearance({ ...appearance, ...values });
  store.set('appearance', JSON.stringify(appearance));
  applyAppearance();
}
export function applyAppearance() {
  const theme = appearance.theme === 'auto' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : appearance.theme;
  const changed = document.documentElement.dataset.theme && document.documentElement.dataset.theme !== theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.font = appearance.font;
  document.documentElement.style.setProperty('--fs', `${appearance.fs}px`);
  document.documentElement.style.setProperty('--measure', `${appearance.measure}ch`);
  document.documentElement.style.setProperty('--reading-measure', `${appearance.measure * appearance.fs / 2}px`);
  document.body.classList.toggle('fill-reading', appearance.fill);
  document.body.classList.toggle('focus-mode', appearance.focus);
  document.body.classList.toggle('code-wrap', appearance.wrap);
  document.dispatchEvent(new Event('appearance-change'));
  document.querySelector('#hl').href = `/vendor/hl-${theme}.css`;
  document.querySelector('#focus').textContent = appearance.focus ? 'Exit focus' : 'Focus';
  document.querySelector('#theme').setAttribute('aria-label', `Theme: ${appearance.theme}. Change theme`);
  for (const name of ['font', 'measure']) document.querySelector(`#${name}`).value = appearance[name];
  document.querySelector('#text-size').value = appearance.fs;
  document.querySelector('#fill-window').checked = appearance.fill;
  document.querySelector('#measure-value').value = `${appearance.measure} characters`;
  document.querySelector('#size-value').value = `${appearance.fs}px`;
  document.querySelector('#measure').disabled = appearance.fill;
  document.querySelector('#measure-control').hidden = appearance.fill;
  for (const control of document.querySelectorAll('[name="appearance-theme"]')) control.checked = control.value === appearance.theme;
  if (changed) document.dispatchEvent(new Event('reader-theme-change'));
}
