import { select, toast } from './dom.js';
import { state } from './state.js';
import { showDialog } from './orientation.js';
import { capturePosition } from './continuity.js';
import { downloadExport } from './export.js';

export function reference(path, heading, selection = '') {
  return `${selection ? '> ' + selection.trim().replace(/\n/g, '\n> ') + '\n\n' : ''}[${path.replace(/[\[\]\\]/g, '\\$&')}${heading ? ' § ' + heading : ''}](${encodeURI(path).replace(/[()]/g, character => '%' + character.charCodeAt(0).toString(16))}${heading ? '#' + encodeURIComponent(heading) : ''})`;
}

async function copy(value) {
  try { await navigator.clipboard.writeText(value); toast('Copied'); }
  catch { toast('Clipboard unavailable. Select and copy the reference from the dialog.'); const text = select('#export-text'); text.value = value; showDialog(select('#export-dialog')); }
}

export function setupActions() {
  let storageWarning = false;
  document.addEventListener('storage-unavailable', () => { if (!storageWarning) { storageWarning = true; toast('Browser storage unavailable. Reading still works; enable storage to retain preferences.'); } });
  const palette = document.createElement('dialog'); palette.id = 'palette'; palette.setAttribute('aria-label', 'Command palette');
  palette.innerHTML = '<h2>Commands and keyboard map</h2><input id="palette-query" aria-label="Filter commands"><div id="palette-actions"></div><button id="palette-close">Close</button>';
  document.body.append(palette);
  const trigger = document.createElement('button'); trigger.id = 'commands-open'; trigger.textContent = 'Commands'; trigger.title = 'Commands (Ctrl/Cmd+K)'; select('#review-tools').append(trigger);
  const exportButton = document.createElement('button'); exportButton.id = 'export-document'; exportButton.textContent = 'Export HTML'; select('#review-tools').append(exportButton);
  exportButton.onclick = async () => { try { await downloadExport(); toast('HTML download prepared'); } catch (error) { toast(error.message); } };
  const selectionButton = document.createElement('button'); selectionButton.id = 'copy-reference'; selectionButton.textContent = 'Copy reference'; select('#review-tools').append(selectionButton);
  let selected = '';
  selectionButton.onpointerdown = () => { selected = window.getSelection()?.toString() || ''; };
  selectionButton.onclick = () => copy(reference(state.currentPath, capturePosition().heading, selected || window.getSelection()?.toString() || ''));
  const shortcuts = { navtog: 'b', q: '/', 'quick-dialog': 'Ctrl/Cmd+P', 'find-query': 'Ctrl/Cmd+F', 'commands-open': 'Ctrl/Cmd+K', 'trail-return': 'Alt+Left' };
  const show = () => {
    const input = select('#palette-query'); input.value = '';
    const actions = [...document.querySelectorAll('header button,#review-tools button,#chain button,#nav button,#trail-bar button')].filter(button => button !== trigger && !button.hidden && !button.disabled);
    const render = () => {
      const list = select('#palette-actions'); list.replaceChildren();
      for (const source of actions.filter(button => `${button.textContent} ${button.getAttribute('aria-label')}`.toLowerCase().includes(input.value.toLowerCase()))) {
        const button = document.createElement('button'); button.textContent = `${source.getAttribute('aria-label') || source.textContent} ${shortcuts[source.id] || ''}`;
        button.onclick = () => { palette.close(); source.click(); }; list.append(button);
      }
      for (const [label, shortcut] of [['Quick open', 'Ctrl/Cmd+P'], ['Find in document', 'Ctrl/Cmd+F'], ['Search', '/']]) {
        if (!label.toLowerCase().includes(input.value.toLowerCase())) continue;
        const button = document.createElement('button'); button.textContent = `${label} — ${shortcut}`;
        button.onclick = () => { palette.close(); select('#scroller').focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: shortcut === '/' ? '/' : shortcut.endsWith('P') ? 'p' : 'f', ctrlKey: shortcut !== '/', bubbles: true })); }; list.append(button);
      }
    };
    input.oninput = render; render(); showDialog(palette); input.focus();
  };
  trigger.onclick = show; select('#palette-close').onclick = () => palette.close();
  palette.onkeydown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    const buttons = [...palette.querySelectorAll('#palette-actions button')];
    if (event.key === 'Enter' && document.activeElement === select('#palette-query')) { event.preventDefault(); buttons[0]?.click(); }
    else if (event.key !== 'Enter') { event.preventDefault(); const index = buttons.indexOf(document.activeElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
  };
  window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!document.querySelector('dialog[open]')) show(); } });
}
