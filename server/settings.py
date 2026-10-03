import os
import shutil
import tempfile
from pathlib import Path


def default_settings(project, home=None, environment=None):
    environment = os.environ if environment is None else environment
    home = Path.home() if home is None else Path(home)
    if environment.get('READER_SETTINGS'):
        return Path(environment['READER_SETTINGS']).expanduser()
    config = Path(environment.get('XDG_CONFIG_HOME') or home / '.config')
    if not config.is_absolute():
        config = home / '.config'
    destination = config / 'passage'
    destination.mkdir(parents=True, exist_ok=True)
    marker = destination / '.legacy-migrated'
    if not marker.exists():
        legacy = Path(project) / '.state'
        sources = [legacy / 'roots.json', *sorted(legacy.glob('reviews-*.json'))] if not legacy.is_symlink() else []
        for source in sources:
            if source.is_symlink() or not source.is_file():
                continue
            target = destination / source.name
            if target.exists() or target.is_symlink():
                continue
            with tempfile.NamedTemporaryFile(dir=destination) as temporary:
                with source.open('rb') as stream:
                    shutil.copyfileobj(stream, temporary)
                temporary.flush()
                os.fsync(temporary.fileno())
                try:
                    os.link(temporary.name, target)
                except FileExistsError:
                    continue
        marker.touch(exist_ok=True)
    return destination / 'roots.json'
