import { STORAGE_PREFIX } from './config.js';

export function createStore(storage) {
  return {
    get(key) {
      try {
        return storage().getItem(STORAGE_PREFIX + key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage().setItem(STORAGE_PREFIX + key, value);
      } catch {}
    },
  };
}

export const store = createStore(() => window.localStorage);
export const state = {
  files: [], roots: [], root: store.get('root') || '',
  browsePath: '', currentPath: '', observer: null, searchSequence: 0,
};
