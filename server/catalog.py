from collections import OrderedDict
import re

from . import policy

TITLE_BYTES = 16384
PAGE_SIZE = 100
CACHE_SIZE = 1000
cache = OrderedDict()


def title_from_text(text, filename):
    if text.startswith('---\n'):
        end = text.find('\n---', 4)
        if end >= 0:
            match = re.search(r'^title:\s*(.+)$', text[4:end], re.MULTILINE)
            if match:
                value = match.group(1).strip().strip('\"\'')
                if value and value not in {'|', '>'}:
                    return value[:200]
            text = text[end + 4:]
    match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
    return match.group(1).strip()[:200] if match else filename


def entry(root, relative, read_title=False):
    target = policy.markdown_target(root, relative)
    stat = target.stat()
    if stat.st_size > policy.MAX_FILE_BYTES:
        raise policy.Rejected('file too large', 413)
    key = (str(root), relative, stat.st_mtime_ns, stat.st_size)
    title = cache.get(key)
    if title is None and read_title:
        with target.open('rb') as stream:
            text = stream.read(TITLE_BYTES).decode('utf-8', errors='replace')
        title = title_from_text(text, target.name)
        cache[key] = title
        while len(cache) > CACHE_SIZE:
            cache.popitem(last=False)
    return {'path': relative, 'modified': stat.st_mtime_ns // 1000000, 'size': stat.st_size, 'title': title or target.name}


def page(root, offset=0, titles=True):
    if offset < 0 or offset > policy.MAX_FILES:
        raise policy.Rejected('invalid offset', 400)
    paths = policy.markdown_files(root)
    entries = []
    for relative in paths[offset:offset + PAGE_SIZE]:
        try:
            entries.append(entry(root, relative, titles))
        except (policy.Rejected, OSError):
            continue
    return {'entries': entries, 'next': offset + PAGE_SIZE if offset + PAGE_SIZE < len(paths) else None}
