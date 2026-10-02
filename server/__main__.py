import argparse
import os
from pathlib import Path

from .http import PROJECT, make_server
from .policy import Workspace


def main():
    parser = argparse.ArgumentParser(description='Local read-only Markdown reader')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--root', action='append', default=[])
    arguments = parser.parse_args()
    settings = Path(os.environ.get('READER_SETTINGS', PROJECT / '.state' / 'roots.json'))
    startup = arguments.root or [str(PROJECT / 'examples')]
    workspace = Workspace(Path.home(), startup, settings)
    workspace.save()
    server = make_server(workspace, arguments.port)
    print(f'Open http://127.0.0.1:{server.server_address[1]}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
