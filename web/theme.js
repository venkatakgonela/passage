import { select, toast } from './dom.js';
import { store } from './state.js';

export function setupTheme() {
  const modes = ['auto', 'light', 'dark'];
  let mode = store.get('theme') || 'auto';
  let fontSize = +store.get('fs') || 17;
  const applyTheme = () => {
    const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    select('#hl').href = dark ? '/vendor/hl-dark.css' : '/vendor/hl-light.css';
    select('#theme').textContent = { auto: '◐', light: '☀', dark: '☾' }[mode];
    select('#theme').title = `Theme: ${mode} (click to change)`;
  };
  const applyFont = () => document.documentElement.style.setProperty('--fs', `${fontSize}px`);
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
  select('#theme').onclick = () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    store.set('theme', mode);
    applyTheme();
    toast(`Theme: ${mode}`);
  };
  select('#fsm').onclick = () => { fontSize = Math.max(13, fontSize - 1); store.set('fs', fontSize); applyFont(); };
  select('#fsp').onclick = () => { fontSize = Math.min(24, fontSize + 1); store.set('fs', fontSize); applyFont(); };
  select('#print').onclick = () => print();
  applyTheme();
  applyFont();
}
