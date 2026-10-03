import ast
import inspect
import textwrap
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from server import policy
from server.http import make_handler
import test_path_headers
import test_server


class ContentTypeTests(unittest.TestCase):
    handler = test_path_headers.HeaderSinkTests.handler

    def test_unknown_types_fall_back_before_writer(self):
        for content_type in ['text/plain', 'text/html; unexpected=parameter', '', None]:
            handler = self.handler()
            with self.subTest(content_type=content_type), patch.object(handler, 'send_header', wraps=handler.send_header) as writer:
                handler.send_body(200, b'synthetic', content_type)
                writer.assert_any_call('Content-Type', 'application/octet-stream')

    def test_poisoned_types_never_reach_writer(self):
        for content_type in ['text/html\rInjected: yes', 'text/css\nInjected: yes', 'image/png\r\nInjected: yes']:
            handler = self.handler()
            with self.subTest(content_type=content_type), patch.object(handler, 'send_header') as writer:
                with self.assertRaises(policy.Rejected) as rejected:
                    handler.send_body(200, b'synthetic', content_type)
                self.assertEqual(rejected.exception.status, 500)
                writer.assert_not_called()
                self.assertEqual(handler.wfile.getvalue(), b'')

    def test_legitimate_types_keep_exact_value(self):
        for content_type in ['application/json', 'text/markdown; charset=utf-8', 'text/javascript; charset=utf-8', 'text/html', 'text/css', 'image/png', 'image/jpeg']:
            handler = self.handler()
            with self.subTest(content_type=content_type), patch.object(handler, 'send_header', wraps=handler.send_header) as writer:
                handler.send_body(200, b'synthetic', content_type)
                writer.assert_any_call('Content-Type', content_type)
                self.assertTrue(handler.wfile.getvalue().endswith(b'\r\n\r\nsynthetic'))

    def test_scanner_visible_replacements_at_content_type_call(self):
        tree = ast.parse(textwrap.dedent(inspect.getsource(make_handler(None).send_body)))
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Attribute) and node.func.attr == 'send_header'
                 and node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'Content-Type']
        self.assertEqual(len(calls), 1)
        expression = calls[0].args[1]
        removed = []
        while isinstance(expression, ast.Call) and isinstance(expression.func, ast.Attribute) and expression.func.attr == 'replace':
            self.assertEqual(len(expression.args), 2)
            self.assertTrue(all(isinstance(argument, ast.Constant) for argument in expression.args))
            removed.append((expression.args[0].value, expression.args[1].value))
            expression = expression.func.value
        self.assertCountEqual(removed, [('\r', ''), ('\n', '')])
        self.assertIsInstance(expression, ast.Name)
        self.assertEqual(expression.id, 'content_type')


class ContentTypeRouteTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def test_static_markdown_and_json_exact_types(self):
        for route, expected in [('/', 'text/html'), ('/styles.css', 'text/css'),
                                ('/app.js', 'text/javascript; charset=utf-8'),
                                ('/vendor/marked.min.js', 'text/javascript; charset=utf-8'),
                                ('/api/roots', 'application/json'),
                                ('/api/file?' + urlencode({'root': self.identifier, 'path': 'hello.md'}), 'text/markdown; charset=utf-8')]:
            with self.subTest(route=route):
                status, body, content_type = self.request('GET', route)
                self.assertEqual(status, 200)
                self.assertEqual(content_type, expected)
                self.assertTrue(body)
                self.assertEqual(self.response_headers['X-Content-Type-Options'], 'nosniff')

    def test_unknown_static_mime_uses_fallback(self):
        with patch('server.http.mimetypes.guess_type', return_value=('unknown/synthetic', None)):
            status, body, content_type = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertEqual(content_type, 'application/octet-stream')
        self.assertTrue(body)
