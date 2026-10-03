export function headingKeys(headings) {
  const seen = new Map();
  return headings.map(heading => {
    const text = heading.text.replace(/^#/, '').trim().replace(/\s+/g, ' ').toLowerCase();
    const occurrence = seen.get(text) || 0;
    seen.set(text, occurrence + 1);
    return { ...heading, key: `${text}:${occurrence}` };
  });
}

export function alignedOffset(offset, source, target, sourceMax, targetMax) {
  const pairs = [{ left: 0, right: 0 }];
  for (const heading of headingKeys(source)) {
    const match = headingKeys(target).find(candidate => candidate.key === heading.key);
    if (match && heading.top > pairs.at(-1).left && match.top > pairs.at(-1).right && heading.top < sourceMax && match.top < targetMax) pairs.push({ left: heading.top, right: match.top });
  }
  pairs.push({ left: sourceMax, right: targetMax });
  const upper = pairs.findIndex(pair => pair.left > offset);
  if (upper < 1) return Math.max(0, targetMax);
  const start = pairs[upper - 1], end = pairs[upper];
  return start.right + (end.right - start.right) * (offset - start.left) / Math.max(1, end.left - start.left);
}

export function moveItem(items, index, direction) {
  const result = [...items];
  const next = index + direction;
  if (index < 0 || index >= result.length || next < 0 || next >= result.length) return result;
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function noteTarget(anchor, candidates, exists = true) {
  const heading = anchor.heading && candidates.find(item => item.id === anchor.heading);
  const snippet = anchor.snippet && candidates.find(item => item.text.includes(anchor.snippet));
  return { offset: heading?.top ?? snippet?.top ?? anchor.offset, orphan: !exists || (!heading && !snippet), fallback: heading ? 'heading' : snippet ? 'snippet' : 'offset' };
}

export function exportNotes(notes) {
  const safe = value => value.replace(/[\\`*_{}[\]<>#!|]/g, '\\$&').replace(/\r?\n/g, ' ');
  return notes.map(note => `- **${safe(note.anchor.path)}${note.anchor.heading ? ' — ' + safe(note.anchor.heading) : ''}**\n  ${note.text.split('\n').map(safe).join('\n  ')}`).join('\n\n');
}
