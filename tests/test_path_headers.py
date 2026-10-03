import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server import policy, reviews
from server.http import make_handler
import test_server


class ConfinedPathTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / 'documents'
        self.root.mkdir()
        (self.root / 'hello.md').write_text('synthetic')

    def test_relative_rules_before_filesystem_probes(self):
        for relative in ['../documents/hello.md', str(self.root / 'hello.md'), '.git/secret.md', 'nested/../../hello.md']:
            with self.subTest(relative=relative), patch.object(Path, 'is_symlink', side_effect=AssertionError('premature metadata')):
                with self.assertRaises(policy.Rejected):
                    policy.confined_target(self.root, relative, policy.SKIP)

    def test_symlink_components_even_when_target_is_inside(self):
        (self.root / 'alias.md').symlink_to(self.root / 'hello.md')
        (self.root / 'alias-folder').symlink_to(self.root, target_is_directory=True)
        (self.root / 'dangling.md').symlink_to(self.root / 'missing.md')
        for relative in ['alias.md', 'alias-folder/hello.md', 'alias-folder/missing.md', 'dangling.md']:
            with self.subTest(relative=relative), self.assertRaises(policy.Rejected):
                policy.confined_target(self.root, relative)

    def test_canonical_separator_boundary(self):
        original = os.path.realpath
        for destination in [self.base / 'documents-sibling/hello.md', self.root, self.base / 'outside/hello.md']:
            def redirected(path, *arguments, **options):
                return str(destination) if Path(path) == self.root / 'hello.md' else original(path, *arguments, **options)
            with self.subTest(destination=destination), patch('server.policy.os.path.realpath', redirected):
                with self.assertRaises(policy.Rejected):
                    policy.confined_target(self.root, 'hello.md')

    def test_lexical_boundary_before_component_probes(self):
        with patch('server.policy.os.path.abspath', return_value=str(self.base / 'documents-sibling/hello.md')):
            with patch.object(Path, 'is_symlink', return_value=False) as probe:
                with self.assertRaises(policy.Rejected):
                    policy.confined_target(self.root, 'hello.md')
                self.assertEqual(probe.call_count, 1)

    def test_root_separator_and_safe_missing_targets(self):
        self.assertEqual(policy.confined_target(self.root, './hello.md'), self.root / 'hello.md')
        self.assertEqual(policy.confined_target(self.root, 'missing/file.md'), self.root / 'missing/file.md')
        with self.assertRaises(policy.Rejected):
            policy.confined_target(self.root, '.')
        with patch.object(Path, 'is_symlink', return_value=False), patch('server.policy.os.path.realpath', side_effect=lambda path: str(path)):
            self.assertEqual(policy.confined_target(Path(os.path.abspath(os.sep)), 'synthetic.md'), Path(os.path.abspath('/synthetic.md')))

    def test_anchor_lists_and_notes_share_confinement(self):
        (self.root / 'alias').symlink_to(self.root, target_is_directory=True)
        for relative in ['alias/missing.md', '../documents/hello.md', '.git/missing.md', str(self.root / 'hello.md'), 'wrong.txt', 'bad\\name.md']:
            for location in ['lists', 'notes']:
                anchor = {'path': relative, 'heading': '', 'snippet': '', 'offset': 0}
                value = {'version': 1, 'revision': 0, 'lists': [], 'notes': []}
                value[location] = [{'name': 'Synthetic', 'items': [anchor]}] if location == 'lists' else [{'anchor': anchor, 'text': 'Synthetic'}]
                with self.subTest(relative=relative, location=location), self.assertRaises(policy.Rejected) as rejected:
                    reviews.validate(self.root, value)
                self.assertEqual(rejected.exception.status, 400)
        reviews.anchor(self.root, {'path': 'missing/file.md', 'heading': '', 'snippet': '', 'offset': 0})


class HeaderSinkTests(unittest.TestCase):
    def handler(self):
        handler = object.__new__(make_handler(None))
        handler.request_version = 'HTTP/1.1'
        handler.requestline = 'GET / HTTP/1.1'
        handler.command = 'GET'
        handler.wfile = io.BytesIO()
        return handler

    def test_every_header_value_rejects_cr_and_lf(self):
        for name in ['Content-Type', 'Server', 'Date', 'X-Synthetic']:
            for value in ['safe\rInjected: yes', 'safe\nInjected: yes', 'safe\r\nInjected: yes']:
                handler = self.handler()
                with self.subTest(name=name, value=value), self.assertRaises(policy.Rejected):
                    handler.send_header(name, value)
                self.assertEqual(handler._headers_buffer, [])
                self.assertEqual(handler.wfile.getvalue(), b'')

    def test_rejected_body_discards_buffered_success(self):
        handler = self.handler()
        with self.assertRaises(policy.Rejected):
            handler.send_body(200, b'not sent', 'text/plain\r\nInjected: yes')
        handler.send_body(500, {'error': 'invalid response header'})
        response = handler.wfile.getvalue()
        self.assertEqual(response.count(b'HTTP/1.0 '), 1)
        self.assertTrue(response.startswith(b'HTTP/1.0 500'))
        self.assertNotIn(b'Injected', response)
        self.assertNotIn(b'not sent', response)

    def test_valid_headers_and_body_unchanged(self):
        handler = self.handler()
        handler.send_body(200, b'synthetic', 'text/css')
        self.assertIn(b'Content-Type: text/css\r\n', handler.wfile.getvalue())
        self.assertTrue(handler.wfile.getvalue().endswith(b'\r\n\r\nsynthetic'))


class StaticBoundaryTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def test_static_assets_and_symlinks(self):
        assets = self.base / 'assets'
        for directory in ['web', 'vendor']:
            root = assets / directory
            root.mkdir(parents=True)
            (root / 'safe.js').write_text('synthetic')
            (root / 'alias.js').symlink_to(root / 'safe.js')
            (root / 'escape.js').symlink_to(self.outside / 'secret.md')
            (root / 'linked').symlink_to(root, target_is_directory=True)
        with patch('server.http.PROJECT', assets):
            for prefix in ['/', '/vendor/']:
                self.assertEqual(self.request('GET', prefix + 'safe.js')[0], 200)
                for name in ['alias.js', 'escape.js', 'linked/safe.js', '%2e%2e/web/safe.js']:
                    with self.subTest(prefix=prefix, name=name):
                        self.assertEqual(self.request('GET', prefix + name)[0], 404)

    def test_bad_mime_returns_clean_error_response(self):
        with patch('server.http.mimetypes.guess_type', return_value=('text/html\r\nInjected: yes', None)):
            status, body, content_type = self.request('GET', '/')
        self.assertEqual(status, 500)
        self.assertEqual(content_type, 'application/json')
        self.assertNotIn('Injected', self.response_headers)
        self.assertNotIn(b'HTTP/1.0', body)
