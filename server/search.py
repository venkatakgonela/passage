import os
import re
from pathlib import Path

from . import policy

MAX_SCAN = policy.MAX_FILES
MAX_ENTRIES = 10000
MAX_BYTES = 16 * 1024 * 1024


def candidates(root):
    pending = [root]
    visited = 0
    while pending:
        directory = pending.pop()
        try:
            with os.scandir(directory) as stream:
                entries = sorted(stream, key=lambda entry: entry.name)
                for entry in entries:
                    visited += 1
                    if visited > MAX_ENTRIES:
                        yield None
                        return
                    if entry.is_symlink() or entry.name in policy.SKIP:
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        pending.append(Path(entry.path))
                    elif entry.name.endswith('.md') and entry.is_file(follow_symlinks=False):
                        yield Path(entry.path).relative_to(root).as_posix()
        except OSError:
            continue


def patterns(query, phrase=False, case=False, word=False):
    if not 2 <= len(query.strip()) <= 200:
        raise policy.Rejected('query must contain 2–200 characters', 400)
    terms = [query.strip()] if phrase else query.split()
    return [re.compile((r'\b' if word else '') + re.escape(term) + (r'\b' if word else ''), 0 if case else re.IGNORECASE) for term in terms]


def search(root, query, scope='workspace', path='', phrase=False, case=False, word=False):
    matchers = patterns(query, phrase, case, word)
    if scope not in {'workspace', 'folder', 'document'}:
        raise policy.Rejected('invalid scope', 400)
    if scope != 'workspace':
        policy.markdown_target(root, path)
    folder = str(Path(path).parent)
    hits, scanned, consumed, truncated = [], 0, 0, False
    enumerated = [path] if scope == 'document' else list(candidates(root))
    truncated = None in enumerated
    paths = sorted(relative for relative in enumerated if relative is not None)
    if scope == 'folder' and folder != '.':
        paths = [relative for relative in paths if relative.startswith(folder + '/')]
    if len(paths) > policy.MAX_FILES:
        truncated = True
        paths = paths[:policy.MAX_FILES]
    total = len(paths)
    for relative in paths:
        if relative is None or scanned >= MAX_SCAN or consumed >= MAX_BYTES or len(hits) >= policy.MAX_HITS:
            truncated = True
            break
        if scope == 'folder' and folder != '.' and not relative.startswith(folder + '/'):
            continue
        scanned += 1
        try:
            target = policy.markdown_target(root, relative)
            size = target.stat().st_size
            if consumed + size > MAX_BYTES:
                truncated = True
                break
            consumed += size
            text = policy.read_markdown(root, relative)
        except (policy.Rejected, OSError):
            continue
        if not all(pattern.search(relative) or pattern.search(text) for pattern in matchers):
            continue
        first = matchers[0].search(text)
        position = first.start() if first else 0
        hits.append({'path': relative, 'snippet': ' '.join(text[max(0, position - 50):position + 150].split()),
                     'count': sum(sum(1 for unused in pattern.finditer(text)) for pattern in matchers),
                     'filename': all(pattern.search(relative) is not None for pattern in matchers)})
    hits.sort(key=lambda hit: (-hit['filename'], -hit['count'], hit['path']))
    return {'hits': hits, 'truncated': truncated, 'scanned': scanned, 'total': total}
