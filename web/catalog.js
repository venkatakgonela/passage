import { requestJson } from './dom.js';
import { state } from './state.js';

export async function fetchCatalog(titles = true) {
  const root = state.root;
  const entries = [];
  let offset = 0;
  do {
    const result = await requestJson(`/api/catalog?root=${root}&offset=${offset}&titles=${titles}`);
    entries.push(...result.entries);
    offset = result.next;
  } while (offset !== null && entries.length < 5000 && root === state.root);
  if (root !== state.root) return null;
  return entries.slice(0, 5000);
}
