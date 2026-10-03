import { showDialog } from './orientation.js';

export function actionStatus(container, message) {
  let status = container.querySelector(':scope > .action-status');
  if (!status) { status = document.createElement('p'); status.className = 'action-status'; status.setAttribute('role', 'status'); container.append(status); }
  status.textContent = message;
}

export function askConfirmation(message, label = 'Continue') {
  const dialog = document.createElement('dialog'); dialog.id = 'confirmation-dialog'; dialog.setAttribute('aria-labelledby', 'confirmation-title');
  const title = document.createElement('h2'); title.id = 'confirmation-title'; title.textContent = 'Confirm action';
  const text = document.createElement('p'); text.textContent = message;
  const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
  const accept = document.createElement('button'); accept.textContent = label;
  dialog.append(title, text, cancel, accept); document.body.append(dialog);
  return new Promise(resolve => {
    let accepted = false;
    cancel.onclick = () => dialog.close();
    accept.onclick = () => { accepted = true; dialog.close(); };
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancel) { event.preventDefault(); accept.focus(); }
      else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === accept) { event.preventDefault(); cancel.focus(); }
    });
    showDialog(dialog); cancel.focus();
    dialog.addEventListener('close', () => { dialog.remove(); resolve(accepted); }, { once: true });
  });
}
