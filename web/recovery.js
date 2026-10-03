export function recovery(container, message, retry) {
  container.replaceChildren();
  const panel = document.createElement('section'); panel.className = 'recovery'; panel.setAttribute('role', 'status');
  const title = document.createElement('h2'); title.textContent = 'Unable to open this content';
  const text = document.createElement('p'); text.textContent = message;
  const button = document.createElement('button'); button.textContent = 'Retry'; button.onclick = retry;
  const help = document.createElement('p'); help.textContent = 'Check the local server and folder permissions, or choose another document/workspace.';
  panel.append(title, text, help, button); container.append(panel);
}
