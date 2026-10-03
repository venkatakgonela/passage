import { select, requestJson, toast } from './dom.js';
import { state } from './state.js';
import { showDialog } from './orientation.js';
import { capturePosition, visit } from './continuity.js';
import { moveItem, noteTarget, exportNotes } from './review-model.js';
import { setupCompare } from './compare.js';
import { stableChange } from './layout.js';

let records, openedRoot, anchor;

function captureAnchor() {
  const position = capturePosition();
  const selection = window.getSelection();
  const snippet = selection?.anchorNode && select('#doc').contains(selection.anchorNode) ? selection.toString().trim().slice(0, 300) : '';
  return { path: state.currentPath, heading: position.heading.slice(0, 200), snippet: snippet || position.snippet, offset: position.offset };
}

function candidates() {
  const pane = select('#scroller');
  return [...select('#doc').querySelectorAll('h1,h2,h3,h4,p,li')].map(element => ({ id: element.id, text: element.textContent, top: element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop }));
}

async function save(next, status) {
  try {
    if (openedRoot !== state.root) throw new Error('Workspace changed; reopen this dialog');
    records = await requestJson(`/api/reviews?root=${openedRoot}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    select(status).textContent = 'Saved locally';
    return true;
  } catch (error) { select(status).textContent = error.message; return false; }
}

function action(label, handler) {
  const button = document.createElement('button'); button.textContent = label; button.onclick = handler; return button;
}

function jump(reference, dialog) {
  if (!state.files.includes(reference.path)) { toast('Reference is missing'); return; }
  dialog.close(); visit(reference.path, '', { ...reference, delta: 0, snippetDelta: 0 });
}

function lists() {
  const selector = select('#list-select'), previous = selector.selectedIndex;
  selector.replaceChildren();
  records.lists.forEach((list, index) => { const option = document.createElement('option'); option.value = index; option.textContent = list.name; selector.append(option); });
  selector.selectedIndex = Math.max(0, Math.min(previous, records.lists.length - 1));
  const container = select('#list-items'); container.replaceChildren();
  const index = selector.selectedIndex, collection = records.lists[index];
  if (!collection) return;
  collection.items.forEach((reference, itemIndex) => {
    const row = document.createElement('div'); row.className = 'review-row';
    const label = `${reference.path}${reference.heading ? ' — ' + reference.heading : ''}${state.files.includes(reference.path) ? '' : ' (missing)'}`;
    row.append(action(label, () => jump(reference, select('#lists-dialog'))));
    for (const [name, direction] of [['Move up', -1], ['Move down', 1]]) {
      const button = action(name, async () => {
        const next = structuredClone(records); next.lists[index].items = moveItem(collection.items, itemIndex, direction);
        if (await save(next, '#list-status')) { lists(); select('#list-items').children[itemIndex + direction]?.querySelector('button')?.focus(); }
      });
      button.disabled = itemIndex + direction < 0 || itemIndex + direction >= collection.items.length; row.append(button);
    }
    row.append(action('Remove', async () => { const next = structuredClone(records); next.lists[index].items.splice(itemIndex, 1); if (await save(next, '#list-status')) lists(); }));
    container.append(row);
  });
}

async function notes() {
  const container = select('#note-items'); container.replaceChildren();
  for (const [index, note] of records.notes.entries()) {
    const row = document.createElement('div'); row.className = 'review-row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.dataset.index = index; checkbox.setAttribute('aria-label', `Export note ${index + 1}`);
    let orphan = !state.files.includes(note.anchor.path);
    if (note.anchor.path === state.currentPath) orphan = noteTarget(note.anchor, candidates(), !orphan).orphan;
    const label = document.createElement('p'); label.textContent = `${note.anchor.path} — ${note.anchor.heading || 'passage'}${orphan ? ' (orphaned)' : note.anchor.path !== state.currentPath ? ' (anchor checked when opened)' : ''}`;
    const text = document.createElement('p'); text.textContent = note.text;
    row.append(checkbox, label, text, action('Jump to note', () => jump(note.anchor, select('#notes-dialog'))), action('Remove note', async () => {
      const next = structuredClone(records); next.notes.splice(index, 1); if (await save(next, '#note-status')) notes();
    })); container.append(row);
  }
}

export function setupReviews() {
  setupCompare();
  new ResizeObserver(entries => select('#scroller').style.setProperty('--review-bar-height', `${entries[0].target.getBoundingClientRect().height}px`)).observe(select('#review-tools'));
  for (const [trigger, dialog, render] of [['#lists-open', '#lists-dialog', lists], ['#notes-open', '#notes-dialog', notes]]) {
    select(trigger).onclick = async () => {
      anchor = captureAnchor(); openedRoot = state.root;
      try {
        records = await requestJson(`/api/reviews?root=${openedRoot}`);
        if (openedRoot !== state.root) return;
        select('#note-anchor').textContent = `Anchor: ${anchor.path} — ${anchor.heading || 'passage'}`;
        select('#list-status').textContent = ''; select('#note-status').textContent = '';
        render(); showDialog(select(dialog));
      } catch (error) { toast(error.message); }
    };
  }
  select('#list-select').onchange = lists;
  select('#list-create').onclick = async () => {
    const next = structuredClone(records); next.lists.push({ name: select('#list-name').value.trim(), items: [] });
    if (await save(next, '#list-status')) { lists(); select('#list-select').selectedIndex = next.lists.length - 1; lists(); }
  };
  select('#list-rename').onclick = async () => {
    const next = structuredClone(records), index = select('#list-select').selectedIndex;
    if (!next.lists[index]) return;
    next.lists[index].name = select('#list-name').value.trim(); if (await save(next, '#list-status')) lists();
  };
  select('#list-delete').onclick = async () => {
    const next = structuredClone(records), index = select('#list-select').selectedIndex;
    if (index < 0) return;
    next.lists.splice(index, 1); if (await save(next, '#list-status')) lists();
  };
  select('#list-add').onclick = async () => {
    const next = structuredClone(records), index = select('#list-select').selectedIndex;
    if (!next.lists[index]) return;
    next.lists[index].items.push(anchor); if (await save(next, '#list-status')) lists();
  };
  select('#note-add').onclick = async () => {
    const next = structuredClone(records); next.notes.push({ anchor, text: select('#note-text').value });
    if (await save(next, '#note-status')) { select('#note-text').value = ''; notes(); }
  };
  select('#notes-export').onclick = () => {
    const selected = [...select('#note-items').querySelectorAll('input:checked')].map(input => records.notes[Number(input.dataset.index)]);
    select('#export-text').value = exportNotes(selected); showDialog(select('#export-dialog'));
  };
  select('#export-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(select('#export-text').value); toast('Notes copied'); }
    catch { toast('Clipboard unavailable; select and copy the text'); }
  };
  let sequence = 0;
  document.addEventListener('document-ready', async () => {
    const current = ++sequence, root = state.root, path = state.currentPath;
    try {
      const siblings = await requestJson(`/api/chain?${new URLSearchParams({ root, path })}`);
      if (current !== sequence || root !== state.root || path !== state.currentPath) return;
      stableChange(() => {
        const strip = select('#chain'); strip.replaceChildren(); strip.hidden = !siblings.length;
        for (const sibling of siblings) {
          const button = action(`${sibling.path.split('/').at(-1)}${sibling.status ? ' · ' + sibling.status : ''}`, () => visit(sibling.path, capturePosition().heading));
          button.disabled = sibling.path === path; strip.append(button);
        }
      });
    } catch { select('#chain').hidden = true; }
  });
}
