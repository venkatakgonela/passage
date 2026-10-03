import hashlib
import json
from pathlib import Path

SKIP = {'.git', 'node_modules', 'vendor', '.venv', '__pycache__', '.state'}
MAX_FILES = 5000
MAX_HITS = 60
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_BODY_BYTES = 16 * 1024
MAX_BROWSE = 1000


class Rejected(ValueError):
    def __init__(self, message='not found', status=404):
        super().__init__(message)
        self.status = status


def within(path, root):
    return path == root or root in path.parents


def root_id(path):
    return hashlib.sha1(str(path).encode()).hexdigest()[:10]


def markdown_target(root, relative):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts or SKIP.intersection(path.parts):
        raise Rejected()
    target = root / path
    if any(part.is_symlink() for part in [target, *target.parents] if part != root and within(part, root)):
        raise Rejected()
    target = target.resolve()
    if not within(target, root) or target == root or target.suffix != '.md' or not target.is_file():
        raise Rejected()
    return target


def read_markdown(root, relative):
    target = markdown_target(root, relative)
    try:
        with target.open('rb') as stream:
            content = stream.read(MAX_FILE_BYTES + 1)
    except OSError as error:
        raise Rejected() from error
    if len(content) > MAX_FILE_BYTES:
        raise Rejected('file too large', 413)
    return content.decode('utf-8', errors='replace')


def markdown_files(root):
    import os
    found = []
    for directory, folders, files in os.walk(root, followlinks=False):
        folders[:] = sorted(folder for folder in folders if folder not in SKIP and not (Path(directory) / folder).is_symlink())
        for name in sorted(files):
            target = Path(directory) / name
            if target.suffix == '.md' and not target.is_symlink() and target.is_file():
                found.append(target.relative_to(root).as_posix())
                if len(found) == MAX_FILES:
                    return sorted(found)
    return sorted(found)


class Workspace:
    def __init__(self, home, startup_roots, settings):
        self.home = Path(home).resolve()
        self.settings = Path(settings).resolve()
        startup = [Path(root).expanduser().resolve() for root in startup_roots]
        self.boundaries = list(dict.fromkeys([self.home, *startup]))
        try:
            persisted = json.loads(self.settings.read_text())
        except (OSError, ValueError):
            persisted = []
        if not isinstance(persisted, list):
            persisted = []
        self.roots = []
        for raw in [*persisted, *startup]:
            try:
                root = self.folder(raw)
            except (Rejected, TypeError, ValueError, OSError):
                continue
            if root not in self.roots:
                self.roots.append(root)

    def folder(self, raw):
        if not isinstance(raw, (str, Path)):
            raise Rejected('invalid folder', 400)
        path = Path(raw).expanduser().resolve()
        allowed = [boundary for boundary in self.boundaries if within(path, boundary)]
        if not allowed:
            raise Rejected('folder outside allowed boundaries', 403)
        if all(any(part.startswith('.') or part in SKIP for part in path.relative_to(boundary).parts) for boundary in allowed):
            raise Rejected('folder unavailable', 403)
        if within(self.settings.parent, path):
            raise Rejected('Folder overlaps the reader settings directory. Choose another folder or relocate READER_SETTINGS.', 403)
        if not path.is_dir():
            raise Rejected('not a folder', 404)
        return path

    def save(self):
        self.settings.parent.mkdir(parents=True, exist_ok=True)
        self.settings.write_text(json.dumps([str(root) for root in self.roots], indent=2))

    def find(self, identifier):
        root = next((root for root in self.roots if root_id(root) == identifier), None)
        if root is None:
            raise Rejected('unknown root')
        return self.folder(root)

    def browse(self, raw):
        path = Path(raw or self.home).expanduser().resolve()
        if not any(within(path, boundary) for boundary in self.boundaries):
            raise Rejected('folder outside allowed boundaries', 403)
        if not path.is_dir():
            raise Rejected('not a folder')
        valid = [boundary for boundary in self.boundaries if within(path, boundary)]
        if all(any(part.startswith('.') or part in SKIP for part in path.relative_to(boundary).parts) for boundary in valid):
            raise Rejected('folder unavailable', 403)
        directories = []
        try:
            for child in path.iterdir():
                if child.name.startswith('.') or child.name in SKIP or child.is_symlink() or not child.is_dir():
                    continue
                directories.append(child.name)
                if len(directories) == MAX_BROWSE:
                    break
        except OSError as error:
            raise Rejected('folder unavailable', 403) from error
        parent = str(path.parent) if any(within(path.parent, boundary) for boundary in self.boundaries) else None
        return {'path': str(path), 'parent': parent, 'dirs': sorted(directories)}
