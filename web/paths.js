export function slug(text, used) {
  const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim().replace(/\s+/g, '-') || 'section';
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) candidate = `${base}-${++suffix}`;
  used.add(candidate);
  return candidate;
}

export function resolvePath(directory, relative) {
  const parts = relative.startsWith('/') ? [] : directory.split('/').filter(Boolean);
  for (const part of relative.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

export function initialFile(files) {
  return files.find(file => /^readme\.md$/i.test(file)) || files[0];
}

export const hashPath = () => decodeURIComponent(location.hash.slice(1));
