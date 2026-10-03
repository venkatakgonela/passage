import json
import os
import tempfile
import uuid
from pathlib import Path
from threading import RLock

from . import policy

MAX_BYTES = 256 * 1024
lock = RLock()


def shape(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise policy.Rejected('invalid record shape', 400)


def string(value, limit, empty=True):
    if not isinstance(value, str) or len(value) > limit or (not empty and not value.strip()):
        raise policy.Rejected('invalid text', 400)


def anchor(root, value):
    shape(value, ['path', 'heading', 'snippet', 'offset'])
    string(value['path'], 500, False)
    string(value['heading'], 200)
    string(value['snippet'], 300)
    if type(value['offset']) not in {int, float} or not 0 <= value['offset'] <= 10000000:
        raise policy.Rejected('invalid offset', 400)
    path = Path(value['path'])
    if '\\' in value['path'] or path.suffix != '.md':
        raise policy.Rejected('invalid anchor path', 400)
    try:
        target = policy.confined_target(root, value['path'], policy.SKIP)
    except policy.Rejected as error:
        raise policy.Rejected('invalid anchor path', 400) from error
    if target.exists():
        policy.markdown_target(root, value['path'])


def validate(root, value):
    shape(value, ['version', 'revision', 'lists', 'notes'])
    if type(value['version']) is not int or value['version'] != 1 or type(value['revision']) is not int or not 0 <= value['revision'] < 2 ** 53:
        raise policy.Rejected('invalid version or revision', 400)
    if not isinstance(value['lists'], list) or len(value['lists']) > 20 or not isinstance(value['notes'], list) or len(value['notes']) > 200:
        raise policy.Rejected('too many records', 400)
    count = 0
    for collection in value['lists']:
        shape(collection, ['name', 'items'])
        string(collection['name'], 100, False)
        if not isinstance(collection['items'], list):
            raise policy.Rejected('invalid list', 400)
        count += len(collection['items'])
        if count > 200:
            raise policy.Rejected('too many references', 400)
        for item in collection['items']:
            anchor(root, item)
    for note in value['notes']:
        shape(note, ['anchor', 'text'])
        anchor(root, note['anchor'])
        string(note['text'], 4000, False)
    return value


def storage(workspace, identifier):
    workspace.find(identifier)
    target = workspace.settings.parent / ('reviews-' + identifier + '.json')
    if target.is_symlink() or any(policy.within(target.resolve(), root) for root in workspace.roots):
        raise policy.Rejected('unsafe settings location', 403)
    return target


def load(workspace, identifier):
    target = storage(workspace, identifier)
    if not target.exists():
        return {'version': 1, 'revision': 0, 'lists': [], 'notes': []}
    with target.open('rb') as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise policy.Rejected('settings too large', 413)
    return validate(workspace.find(identifier), json.loads(data))


def save(workspace, identifier, value):
    with lock:
        root = workspace.find(identifier)
        validate(root, value)
        previous = load(workspace, identifier)
        if previous['revision'] != value['revision']:
            raise policy.Rejected('review state changed; reopen and retry', 409)
        updated = {**value, 'revision': value['revision'] + 1}
        data = json.dumps(updated).encode()
        if len(data) > MAX_BYTES:
            raise policy.Rejected('settings too large', 413)
        target = storage(workspace, identifier)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.review-', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
        return updated


def reset_corrupt(workspace, identifier, payload):
    shape(payload, [])
    with lock:
        target = storage(workspace, identifier)
        try:
            load(workspace, identifier)
        except (ValueError, UnicodeError) as error:
            if isinstance(error, policy.Rejected) and error.status not in {400, 413}:
                raise
            backup = target.with_name(target.name + '.corrupt-' + uuid.uuid4().hex)
            os.rename(target, backup)
            return {'notice': 'Corrupt review settings moved aside. Reopen to start empty; the original is retained beside settings.'}
        raise policy.Rejected('settings are valid; reset refused', 409)
