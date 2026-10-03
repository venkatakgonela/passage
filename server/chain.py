import re
from pathlib import PurePosixPath

from . import policy
from .catalog import TITLE_BYTES

MAX_CHAIN = 20


def family(path):
    target = PurePosixPath(path)
    match = re.fullmatch(r'(.+)-([A-Za-z][\w-]*)', target.stem)
    return (str(target.parent), match.group(1)) if match else None


def metadata(text):
    status = re.search(r'^(?:status|verdict):\s*([^\n]{1,100})', text, re.MULTILINE | re.IGNORECASE)
    related = []
    if text.startswith('---\n'):
        end = text.find('\n---', 4)
        if end >= 0:
            header = text[4:end]
            match = re.search(r'^related:\s*\[([^\n]*)\]', header, re.MULTILINE)
            if match:
                related = [value.strip().strip('\'"') for value in match.group(1).split(',')]
            else:
                match = re.search(r'^related:[ \t]*\n((?:[ \t]+-[^\n]*\n?)*)', header, re.MULTILINE)
                if match:
                    related = [value.strip().removeprefix('-').strip().strip('\'"') for value in match.group(1).splitlines()]
    return {'status': status.group(1).strip() if status else '', 'related': related[:MAX_CHAIN]}


def head(root, path):
    target = policy.markdown_target(root, path)
    with target.open('rb') as stream:
        return metadata(stream.read(TITLE_BYTES).decode('utf-8', errors='replace'))


def chain(root, path):
    current = head(root, path)
    key = family(path)
    paths = [candidate for candidate in policy.markdown_files(root) if key and family(candidate) == key][:MAX_CHAIN]
    for relative in current['related']:
        candidate = (PurePosixPath(path).parent / relative).as_posix()
        if candidate not in paths:
            paths.append(candidate)
    result = []
    for candidate in paths[:MAX_CHAIN]:
        try:
            result.append({'path': candidate, 'status': head(root, candidate)['status']})
        except (policy.Rejected, OSError):
            continue
    return result if any(item['path'] != path for item in result) else []
