import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

from server import policy
from server.http import make_server
from server.policy import Rejected, Workspace, root_id


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name).resolve()
        self.home = self.base / 'home'
        self.root = self.home / 'documents'
        self.outside = self.base / 'outside'
        self.extra = self.base / 'approved'
        for folder in [self.root, self.outside, self.extra]:
            folder.mkdir(parents=True)
        (self.root / 'hello.md').write_text('# Hello\nneedle needle\n')
        (self.outside / 'secret.md').write_text('private needle')
        self.settings = self.base / 'settings' / 'roots.json'
        self.workspace = Workspace(self.home, [self.root, self.extra], self.settings)
        self.server = make_server(self.workspace, 0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.identifier = root_id(self.root)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temporary.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        merged = {'Origin': f'http://127.0.0.1:{self.port}'}
        merged.update(headers or {})
        merged = {key: value for key, value in merged.items() if value is not None}
        connection.request(method, path, body=body, headers=merged)
        response = connection.getresponse()
        self.response_headers = dict(response.getheaders())
        status, data, content_type = response.status, response.read(), response.getheader('Content-Type')
        connection.close()
        return status, data, content_type

    def file(self, relative):
        return self.request('GET', '/api/file?' + urlencode({'root': self.identifier, 'path': relative}))

    def test_loopback_binding(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_static_suffix_whitelist(self):
        assets = self.base / 'assets'
        for directory in ['web', 'vendor']:
            (assets / directory).mkdir(parents=True)
            for suffix in ['.md', '.txt']:
                (assets / directory / ('private' + suffix)).write_text('synthetic private text')
        with patch('server.http.PROJECT', assets):
            for path in ['/private.md', '/private.txt', '/vendor/private.md', '/vendor/private.txt']:
                self.assertEqual(self.request('GET', path)[0], 404)

    def test_nosniff_responses(self):
        for path, headers in [('/api/roots', {}), ('/missing', {}), ('/', {'Host': 'evil.invalid'})]:
            self.request('GET', path, headers=headers)
            self.assertEqual(self.response_headers.get('X-Content-Type-Options'), 'nosniff')

    def test_settings_save_failure_rolls_back_registration(self):
        candidate = self.home / 'new-root'
        candidate.mkdir()
        previous = self.workspace.roots[:]
        with patch.object(self.workspace, 'save', side_effect=OSError('synthetic failure')):
            self.assertEqual(self.request('POST', '/api/roots', json.dumps({'path': str(candidate)}))[0], 500)
        self.assertEqual(self.workspace.roots, previous)
        roots = json.loads(self.request('GET', '/api/roots')[1])
        self.assertNotIn(str(candidate), [root['path'] for root in roots])
        self.assertFalse(self.settings.exists())

    def test_fetch_metadata(self):
        for route in ['/', '/app.js', '/api/roots', '/api/files', '/api/file', '/api/search', '/api/browse']:
            self.assertEqual(self.request('GET', route, headers={'Origin': None, 'Sec-Fetch-Site': 'cross-site'})[0], 403)
        for site in [None, 'none', 'same-origin', 'same-site']:
            self.assertEqual(self.request('GET', '/api/roots', headers={'Origin': None, 'Sec-Fetch-Site': site})[0], 200)
            self.assertEqual(self.request('GET', '/api/roots', headers={'Origin': 'http://localhost:1', 'Sec-Fetch-Site': site})[0], 403)

    def test_host_and_origin_matrix(self):
        routes = ['/', '/app.js', '/vendor/marked.min.js', '/api/roots', '/api/browse', '/api/files', '/api/file', '/api/search', '/unknown']
        for method in ['GET', 'POST', 'DELETE', 'HEAD', 'PUT', 'PATCH', 'OPTIONS', 'TRACE', 'CONNECT', 'UNSUPPORTED']:
            for route in routes:
                for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}, {'Origin': 'null'}, {'Origin': f'http://127.0.0.1:{self.port}/'}, {'Origin': f'http://http://127.0.0.1:{self.port}'}]:
                    with self.subTest(method=method, route=route, headers=headers):
                        self.assertEqual(self.request(method, route, headers=headers)[0], 403)
        self.assertEqual(self.request('GET', '/api/roots', headers={'Origin': None})[0], 200)
        for method in ['POST', 'DELETE']:
            self.assertEqual(self.request(method, '/api/roots', body='{}', headers={'Origin': None})[0], 403)
        for method in ['HEAD', 'PUT', 'PATCH', 'OPTIONS', 'TRACE', 'CONNECT', 'UNSUPPORTED']:
            self.assertEqual(self.request(method, '/api/roots')[0], 405)

    def test_duplicate_headers_rejected(self):
        for header in ['Host', 'Origin']:
            connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
            connection.putrequest('GET', '/api/roots', skip_host=True)
            connection.putheader('Host', f'127.0.0.1:{self.port}')
            connection.putheader('Origin', f'http://127.0.0.1:{self.port}')
            connection.putheader(header, 'evil.invalid')
            connection.endheaders()
            self.assertEqual(connection.getresponse().status, 403)
            connection.close()

    def test_paths_and_static_boundary(self):
        self.assertEqual(self.file('hello.md')[0], 200)
        for path in ['../outside/secret.md', str(self.outside / 'secret.md'), str(self.root / 'hello.md'), '../documents/hello.md', '%2e%2e/secret.md', 'missing.md', 'hello.txt']:
            with self.subTest(path=path):
                self.assertEqual(self.file(path)[0], 404)
        for path in ['/api/file?root=' + self.identifier + '&path=%2e%2e%2foutside%2fsecret.md', '/%2e%2e/server/http.py', '/server/http.py', '/.git/config', '/.state/roots.json', '/examples/task.md', '/vendor/../server/http.py', '/vendor/marked.min.js/extra']:
            self.assertEqual(self.request('GET', path)[0], 404)
        self.assertEqual(self.request('GET', '/app.js')[2], 'text/javascript; charset=utf-8')
        self.assertEqual(self.request('GET', '/vendor/marked.min.js')[0], 200)

    def test_symlink_and_skipped_paths(self):
        (self.root / 'escape.md').symlink_to(self.outside / 'secret.md')
        (self.root / 'external').symlink_to(self.outside, target_is_directory=True)
        (self.root / 'alias.md').symlink_to(self.root / 'hello.md')
        for skipped in policy.SKIP:
            folder = self.root / skipped
            folder.mkdir()
            (folder / 'hidden.md').write_text('private needle')
            self.assertEqual(self.file(skipped + '/hidden.md')[0], 404)
        (self.root / 'alias-folder').symlink_to(self.root / '.git', target_is_directory=True)
        for relative in ['escape.md', 'external/secret.md', 'alias.md', 'alias-folder/hidden.md']:
            self.assertEqual(self.file(relative)[0], 404)
        files = json.loads(self.request('GET', f'/api/files?root={self.identifier}')[1])
        self.assertEqual(files, ['hello.md'])
        hits = json.loads(self.request('GET', f'/api/search?root={self.identifier}&q=needle')[1])
        self.assertEqual([hit['path'] for hit in hits], ['hello.md'])

    def test_file_size_boundary_and_search(self):
        with patch.object(policy, 'MAX_FILE_BYTES', 32):
            for size in [31, 32, 33]:
                (self.root / 'sized.md').write_text('n' * size)
                self.assertEqual(self.file('sized.md')[0], 200 if size <= 32 else 413)
            hits = json.loads(self.request('GET', f'/api/search?root={self.identifier}&q=nn')[1])
            self.assertEqual(hits, [])

    def test_search_and_file_caps(self):
        for index in range(65):
            (self.root / f'item-{index:02}.md').write_text('needle ' * (index + 1))
        hits = json.loads(self.request('GET', f'/api/search?root={self.identifier}&q=needle')[1])
        self.assertEqual(len(hits), 60)
        self.assertEqual(hits[0]['count'], max(hit['count'] for hit in hits))
        with patch.object(policy, 'MAX_FILES', 3):
            self.assertEqual(len(policy.markdown_files(self.root)), 3)
        for term in ['', 'n']:
            self.assertEqual(json.loads(self.request('GET', f'/api/search?root={self.identifier}&q={term}')[1]), [])

    def test_browse_and_registration_boundaries(self):
        self.assertIsNone(self.workspace.browse(str(self.home))['parent'])
        self.assertIsNone(self.workspace.browse(str(self.extra))['parent'])
        (self.home / 'escape').symlink_to(self.outside, target_is_directory=True)
        (self.home / '.hidden').mkdir()
        self.assertNotIn('escape', self.workspace.browse('')['dirs'])
        self.assertNotIn('.hidden', self.workspace.browse('')['dirs'])
        for path in [self.outside, self.home.parent, self.home / 'escape', self.home / '.hidden']:
            self.assertEqual(self.request('GET', '/api/browse?' + urlencode({'path': str(path)}))[0], 403)
            self.assertEqual(self.request('POST', '/api/roots', json.dumps({'path': str(path)}))[0], 403)
        self.assertEqual(self.request('POST', '/api/roots', json.dumps({'path': str(self.extra)}))[0], 200)
        for index in range(5):
            (self.extra / f'folder-{index}').mkdir()
        with patch.object(policy, 'MAX_BROWSE', 3):
            self.assertEqual(len(self.workspace.browse(str(self.extra))['dirs']), 3)
        (self.home / 'not-folder').write_text('synthetic')
        self.assertEqual(self.request('GET', '/api/browse?' + urlencode({'path': str(self.home / 'not-folder')}))[0], 404)

    def test_persistence_cannot_expand_boundaries(self):
        self.settings.parent.mkdir()
        self.settings.write_text(json.dumps([str(self.outside), str(self.root), str(self.extra)]))
        restarted = Workspace(self.home, [], self.settings)
        self.assertEqual(restarted.roots, [self.root])
        (self.home / 'settings').mkdir()
        inside = self.home / 'settings' / 'roots.json'
        guarded = Workspace(self.home, [], inside)
        with self.assertRaises(Rejected):
            guarded.folder(self.home)

    def test_bad_request_bodies(self):
        for body in ['not-json', '{}', '[]', '{"path":1}', '{"path":null}']:
            self.assertEqual(self.request('POST', '/api/roots', body)[0], 400)
        for length in ['-1', 'invalid']:
            self.assertEqual(self.request('POST', '/api/roots', '', {'Content-Length': length})[0], 400)
        self.assertEqual(self.request('POST', '/api/roots', '', {'Content-Length': str(policy.MAX_BODY_BYTES + 1)})[0], 413)
        self.assertEqual(self.request('POST', '/missing', '{}')[0], 404)
        self.assertEqual(self.request('DELETE', '/missing')[0], 404)
        payload = json.dumps({'path': str(self.root)})
        with patch.object(policy, 'MAX_BODY_BYTES', len(payload)):
            self.assertEqual(self.request('POST', '/api/roots', payload)[0], 200)
        with patch.object(policy, 'MAX_BODY_BYTES', len(payload) - 1):
            self.assertEqual(self.request('POST', '/api/roots', payload)[0], 413)

    def test_documents_remain_unchanged(self):
        before = {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob('*') if path.is_file()}
        self.file('hello.md')
        self.request('GET', f'/api/files?root={self.identifier}')
        self.request('GET', f'/api/search?root={self.identifier}&q=needle')
        self.request('POST', '/api/roots', json.dumps({'path': str(self.root)}))
        self.request('DELETE', f'/api/roots?id={self.identifier}')
        self.assertTrue(self.settings.is_file())
        after = {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob('*') if path.is_file()}
        self.assertEqual(before, after)
        self.assertNotIn(self.root, self.workspace.roots)


if __name__ == '__main__':
    unittest.main()
