import { state, store } from './state.js';
import { validateSession } from './continuity-model.js';

export let session = validateSession({}, []);
export function loadSession() {
  let value;
  try { value = JSON.parse(store.get(`workspace.v1.${state.root}`) || '{}'); } catch {}
  session = validateSession(value, state.files);
  return session;
}
export function saveSession() {
  if (!state.root) return;
  store.set(`workspace.v1.${state.root}`, JSON.stringify(session));
  let roots;
  try { roots = JSON.parse(store.get('workspaces.v1') || '[]'); } catch {}
  roots = Array.isArray(roots) ? roots.filter(root => typeof root === 'string' && /^[a-f0-9]{10}$/.test(root) && root !== state.root) : [];
  roots.unshift(state.root);
  for (const root of roots.slice(10)) store.remove(`workspace.v1.${root}`);
  store.set('workspaces.v1', JSON.stringify(roots.slice(0, 10)));
}
