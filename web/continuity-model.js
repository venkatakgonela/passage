export const LIMITS = { history: 100, trail: 8, recents: 30, pins: 30 };
export const validPath = value => typeof value === 'string' && value.length <= 1024 && !value.startsWith('/') && !value.split('/').some(part => part === '..') && value.endsWith('.md');
export function boundedPosition(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return { heading: typeof value.heading === 'string' ? value.heading.slice(0, 200) : '', snippet: typeof value.snippet === 'string' ? value.snippet.slice(0, 160) : '', delta: Number.isFinite(value.delta) ? Math.max(-10000, Math.min(10000, value.delta)) : 0, snippetDelta: Number.isFinite(value.snippetDelta) ? Math.max(-10000, Math.min(10000, value.snippetDelta)) : (Number.isFinite(value.delta) ? value.delta : 0), offset: Number.isFinite(value.offset) ? Math.max(0, Math.min(10000000, value.offset)) : 0 };
}
export function validateSession(value, files) {
  const source = value?.version === 1 ? value : {};
  const paths = list => Array.isArray(list) ? [...new Set(list.filter(path => validPath(path) && files.includes(path)))] : [];
  const records = (list, limit) => Array.isArray(list) ? list.filter(item => item && validPath(item.path) && files.includes(item.path)).slice(-limit).map(item => ({ path: item.path, position: boundedPosition(item.position) })) : [];
  return { version: 1, path: files.includes(source.path) ? source.path : '', position: boundedPosition(source.position), history: records(source.history, LIMITS.history), trail: records(source.trail, LIMITS.trail), recents: paths(source.recents).slice(0, LIMITS.recents), pins: paths(source.pins).slice(0, LIMITS.pins), navWidth: Math.max(200, Math.min(420, Number(source.navWidth) || 280)), tocWidth: Math.max(160, Math.min(320, Number(source.tocWidth) || 190)), sort: source.sort === 'modified' ? 'modified' : 'name', descending: source.descending === true, titles: source.titles !== false, extensions: source.extensions !== false, navHidden: source.navHidden === true };
}
export function appendVisit(list, record, limit) {
  return [...list, { path: record.path, position: boundedPosition(record.position) }].slice(-limit);
}
export function restoreTarget(position, candidates) {
  const heading = position.heading && candidates.find(item => item.id === position.heading);
  if (heading) return { offset: Math.max(0, heading.top + position.delta), fallback: false };
  const snippet = position.snippet && candidates.find(item => item.text.includes(position.snippet));
  if (snippet) return { offset: Math.max(0, snippet.top + (position.snippetDelta ?? position.delta)), fallback: true };
  return { offset: Math.max(0, position.offset || 0), fallback: true };
}
export function sortEntries(entries, options = {}) {
  return [...entries].sort((left, right) => {
    const difference = options.sort === 'modified' ? left.modified - right.modified : left.path.localeCompare(right.path, undefined, { numeric: true, sensitivity: 'base' });
    return (difference || left.path.localeCompare(right.path, undefined, { numeric: true })) * (options.descending ? -1 : 1);
  });
}
export function filterEntries(entries, query) {
  const text = query.trim().toLowerCase();
  return entries.filter(item => (item.path + ' ' + item.title).toLowerCase().includes(text));
}
export function fuzzyEntries(entries, query, limit = 30) {
  const needle = query.toLowerCase().slice(0, 200);
  return entries.map(item => {
    const text = (item.path + ' ' + item.title).toLowerCase();
    let position = -1; let score = 0;
    for (const character of needle) { const next = text.indexOf(character, position + 1); if (next < 0) return null; score += next - position; position = next; }
    return { ...item, score };
  }).filter(Boolean).sort((left, right) => left.score - right.score).slice(0, limit);
}
