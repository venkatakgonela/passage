import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import policy
from .images import read_image
from .policy import Rejected, root_id, within

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

        def send_body(self, status, body, content_type='application/json'):
            data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body)).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
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
            if path == '/api/roots':
                return self.send_body(200, [{'id': root_id(root), 'path': str(root), 'name': root.name or str(root)} for root in workspace.roots])
            if path == '/api/browse':
                return self.send_body(200, workspace.browse(query('path')))
            if path == '/api/files':
                return self.send_body(200, policy.markdown_files(workspace.find(query('root'))))
            if path == '/api/file':
                return self.send_body(200, policy.read_markdown(workspace.find(query('root')), query('path')), 'text/markdown; charset=utf-8')
            if path in {'/api/image', '/api/image-info'}:
                content, metadata = read_image(workspace.find(query('root')), query('path'))
                if path == '/api/image-info':
                    return self.send_body(200, metadata)
                return self.send_body(200, content, metadata['type'])
            if path == '/api/search':
                term = query('q').strip().lower()
                try:
                    root = workspace.find(query('root'))
                except Rejected:
                    return self.send_body(200, [])
                if len(term) < 2:
                    return self.send_body(200, [])
                hits = []
                for relative in policy.markdown_files(root):
                    try:
                        text = policy.read_markdown(root, relative)
                    except Rejected:
                        continue
                    lower = text.lower()
                    position = lower.find(term)
                    if position < 0 and term not in relative.lower():
                        continue
                    snippet = ' '.join(text[max(0, position - 50):position + 110].split()) if position >= 0 else ''
                    hits.append({'path': relative, 'snippet': snippet, 'count': lower.count(term)})
                    if len(hits) >= policy.MAX_HITS:
                        break
                hits.sort(key=lambda hit: -hit['count'])
                return self.send_body(200, hits)
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
            target = root / relative
            if any(part.is_symlink() for part in [target, *target.parents] if within(part, root)):
                raise Rejected()
            target = target.resolve()
            if not within(target, root) or not target.is_file() or target.suffix not in {'.html', '.css', '.js'}:
                raise Rejected()
            content_type = 'text/javascript; charset=utf-8' if target.suffix == '.js' else mimetypes.guess_type(target.name)[0]
            return self.send_body(200, target.read_bytes(), content_type)

        def post(self):
            path, unused_query = self.request_parts()
            if path != '/api/roots':
                raise Rejected()
            lengths = self.headers.get_all('Content-Length', [])
            if self.headers.get('Transfer-Encoding') or len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
                raise Rejected('invalid content length', 400)
            length = int(lengths[0])
            if length > policy.MAX_BODY_BYTES:
                raise Rejected('request too large', 413)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise Rejected('incomplete request', 400)
            payload = json.loads(raw)
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
