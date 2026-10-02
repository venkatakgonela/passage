import { select } from './dom.js';
import { appearance, setAppearance, applyAppearance, DEFAULTS } from './appearance.js';

export function setupTheme() {
  const modes = ['auto', 'light', 'dark'];
  select('#theme').onclick = () => setAppearance({ theme: modes[(modes.indexOf(appearance.theme) + 1) % modes.length] });
  select('#fsm').onclick = () => setAppearance({ fs: appearance.fs - 1 });
  select('#fsp').onclick = () => setAppearance({ fs: appearance.fs + 1 });
  select('#focus').onclick = () => setAppearance({ focus: !appearance.focus });
  select('#font').onchange = event => setAppearance({ font: event.target.value });
  select('#measure').oninput = event => setAppearance({ measure: +event.target.value });
  select('#reset').onclick = () => setAppearance(DEFAULTS);
  select('#appearance').onclick = () => select('#appearance-dialog').showModal();
  select('#appearance-close').onclick = () => select('#appearance-dialog').close();
  select('#print').onclick = () => print();
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyAppearance);
  applyAppearance();
}
