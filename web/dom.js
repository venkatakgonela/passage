export const select = selector => document.querySelector(selector);
export const selectAll = selector => [...document.querySelectorAll(selector)];
export const escapeHtml = text => text.replace(/[&<>"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[character]);

export async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.status);
  }
  return response.json();
}

export function toast(message) {
  const element = select('#toast');
  element.textContent = message;
  element.classList.add('on');
  clearTimeout(element.timer);
  element.timer = setTimeout(() => element.classList.remove('on'), 1400);
}
