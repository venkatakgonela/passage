import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import policy
from . import reviews, search, chain
from .images import read_image
from .policy import Rejected, root_id

PROJECT = Path(__file__).resolve().parent.parent
BIND_HOST = '127.0.0.1'


def make_server(workspace, port):
    server = ThreadingHTTPServer((BIND_HOST, port), make_handler(workspace))
    server.daemon_threads = True
    return server


def make_handler(workspace):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def send_header(self, keyword, value):
            value = str(value)
            if '\r' in value or '\n' in value:
                self._headers_buffer = []
                raise Rejected('invalid response header', 500)
            super().send_header(keyword, value)

        def send_body(self, status, body, content_type='application/json'):
            content_type = str(content_type)
            if '\r' in content_type or '\n' in content_type:
                raise Rejected('invalid response header', 500)
            content_type = next((allowed for allowed in (
                'application/json', 'text/markdown; charset=utf-8',
                'text/javascript; charset=utf-8', 'text/html', 'text/css',
                'image/png', 'image/jpeg',
            ) if content_type == allowed), 'application/octet-stream')
            data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type.replace('\r', '').replace('\n', ''))
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if self.command != 'HEAD':
                try:
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        def guard(self):
            port = self.server.server_address[1]
            hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
            if len(self.headers.get_all('Host', [])) != 1 or self.headers.get('Host') not in hosts:
                raise Rejected('bad host', 403)
            origins = self.headers.get_all('Origin', [])
            if len(origins) > 1 or (origins and origins[0] not in {f'http://{host}' for host in hosts}):
                raise Rejected('bad origin', 403)
            if self.command in {'POST', 'DELETE'} and not origins:
                raise Rejected('bad origin', 403)
            if self.command in {'POST', 'DELETE'}:
                if origins != [f'http://{self.headers.get("Host")}']:
                    raise Rejected('origin does not match host', 403)
                sites = self.headers.get_all('Sec-Fetch-Site', [])
                if len(sites) > 1 or (sites and sites != ['same-origin']):
                    raise Rejected('cross-origin write', 403)
            if self.command == 'GET' and self.headers.get('Sec-Fetch-Site') == 'cross-site':
                raise Rejected('cross-site request', 403)

        def dispatch(self):
            try:
                self.guard()
                if self.command == 'GET':
                    self.get()
                elif self.command == 'POST':
                    self.post()
                elif self.command == 'DELETE':
                    self.delete()
                else:
                    raise Rejected('method not allowed', 405)
            except Rejected as error:
                self.send_body(error.status, {'error': str(error)})
            except (ValueError, TypeError, UnicodeError):
                self.send_body(400, {'error': 'bad request'})
            except OSError:
                self.send_body(500, {'error': 'filesystem unavailable'})

        def request_parts(self):
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            return parsed.path, lambda key: query.get(key, [''])[0]

        def get(self):
            path, query = self.request_parts()
            if path == '/api/reviews':
                with reviews.lock:
                    return self.send_body(200, reviews.load(workspace, query('root')))
            if path == '/api/chain':
                return self.send_body(200, chain.chain(workspace.find(query('root')), query('path')))
            if path == '/api/roots':
                return self.send_body(200, [{'id': root_id(root), 'path': str(root), 'name': root.name or str(root)} for root in workspace.roots])
            if path == '/api/browse':
                return self.send_body(200, workspace.browse(query('path')))
            if path == '/api/files':
                return self.send_body(200, policy.markdown_files(workspace.find(query('root'))))
            if path == '/api/catalog':
                from . import catalog
                try:
                    offset = int(query('offset') or '0')
                except ValueError:
                    raise Rejected('invalid offset', 400)
                return self.send_body(200, catalog.page(workspace.find(query('root')), offset, query('titles') != 'false'))
            if path == '/api/metadata':
                from . import catalog
                return self.send_body(200, catalog.entry(workspace.find(query('root')), query('path'), True))
            if path == '/api/file':
                return self.send_body(200, policy.read_markdown(workspace.find(query('root')), query('path')), 'text/markdown; charset=utf-8')
            if path in {'/api/image', '/api/image-info'}:
                content, metadata = read_image(workspace.find(query('root')), query('path'))
                if path == '/api/image-info':
                    return self.send_body(200, metadata)
                return self.send_body(200, content, metadata['type'])
            if path == '/api/search':
                term = query('q').strip()
                try:
                    root = workspace.find(query('root'))
                except Rejected:
                    return self.send_body(200, [])
                if len(term) < 2:
                    return self.send_body(200, [])
                result = search.search(root, term, query('scope') or 'workspace', query('path'), query('phrase') == 'true', query('case') == 'true', query('word') == 'true')
                return self.send_body(200, result if query('format') == 'details' else result['hits'])
            if path.startswith('/api/'):
                raise Rejected()
            relative = Path(unquote(path).lstrip('/'))
            if '..' in relative.parts:
                raise Rejected()
            root = PROJECT / ('vendor' if relative.parts and relative.parts[0] == 'vendor' else 'web')
            if root.name == 'vendor':
                relative = Path(*relative.parts[1:])
            if path == '/':
                relative = Path('index.html')
            target = policy.confined_target(root, relative)
            if target.suffix not in {'.html', '.css', '.js'} or not target.is_file():
                raise Rejected()
            content_type = 'text/javascript; charset=utf-8' if target.suffix == '.js' else mimetypes.guess_type(target.name)[0]
            return self.send_body(200, target.read_bytes(), content_type)

        def post(self):
            path, query = self.request_parts()
            if path not in {'/api/roots', '/api/reviews', '/api/reviews/reset'}:
                raise Rejected()
            lengths = self.headers.get_all('Content-Length', [])
            if self.headers.get('Transfer-Encoding') or len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
                raise Rejected('invalid content length', 400)
            length = int(lengths[0])
            if length > (reviews.MAX_BYTES if path == '/api/reviews' else policy.MAX_BODY_BYTES):
                raise Rejected('request too large', 413)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise Rejected('incomplete request', 400)
            payload = json.loads(raw)
            if path == '/api/reviews/reset':
                return self.send_body(200, reviews.reset_corrupt(workspace, query('root'), payload))
            if path == '/api/reviews':
                return self.send_body(200, reviews.save(workspace, query('root'), payload))
            if not isinstance(payload, dict) or not isinstance(payload.get('path'), str):
                raise Rejected('bad request', 400)
            root = workspace.folder(payload['path'])
            if root not in workspace.roots:
                workspace.roots.append(root)
                try:
                    workspace.save()
                except OSError:
                    workspace.roots.remove(root)
                    raise
            self.send_body(200, {'id': root_id(root)})

        def delete(self):
            path, query = self.request_parts()
            if path != '/api/roots':
                raise Rejected()
            previous = workspace.roots[:]
            workspace.roots[:] = [root for root in previous if root_id(root) != query('id')]
            try:
                workspace.save()
            except OSError:
                workspace.roots[:] = previous
                raise
            self.send_body(200, {'ok': True})

        do_GET = dispatch
        do_POST = dispatch
        do_DELETE = dispatch
        do_HEAD = dispatch
        do_PUT = dispatch
        do_PATCH = dispatch
        do_OPTIONS = dispatch
        do_TRACE = dispatch
        do_CONNECT = dispatch

        def __getattr__(self, name):
            if name.startswith('do_'):
                return self.dispatch
            raise AttributeError(name)

        def log_message(self, *args):
            pass

    return Handler
