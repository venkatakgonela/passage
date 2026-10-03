import json
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

import test_server
from server import catalog, policy


class CatalogTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def test_title_truncation(self):
        for text in ['# ' + 'x' * 201, '---\ntitle: ' + 'x' * 201 + '\n---']:
            self.assertEqual(catalog.title_from_text(text, 'file.md'), 'x' * 200)

    def test_page_skips_bad_entry(self):
        original = catalog.entry
        def broken_entry(root, relative, titles):
            if relative == 'bad.md':
                raise OSError('unavailable')
            return original(root, relative, titles)
        with patch.object(policy, 'markdown_files', return_value=['bad.md', 'hello.md']), patch.object(catalog, 'entry', broken_entry):
            result = catalog.page(self.root)
        self.assertEqual([item['path'] for item in result['entries']], ['hello.md'])

    def test_titles_false_never_reads_uncached_content(self):
        from pathlib import Path
        catalog.cache.clear()
        with patch.object(Path, 'open', side_effect=AssertionError('unexpected content read')):
            response = self.request('GET', '/api/catalog?root=' + self.identifier + '&titles=false')
        self.assertEqual(response[0], 200)
        self.assertEqual(json.loads(response[1])['entries'][0]['title'], 'hello.md')

    def test_cache_operations_hold_lock(self):
        class CheckedCache(dict):
            def get(inner, key):
                self.assertTrue(catalog.cache_lock._is_owned())
                return super().get(key)

            def __setitem__(inner, key, value):
                self.assertTrue(catalog.cache_lock._is_owned())
                super().__setitem__(key, value)
        from concurrent.futures import ThreadPoolExecutor
        with patch.object(catalog, 'cache', CheckedCache()), ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda unused: catalog.entry(self.root, 'hello.md', True), range(40)))
        self.assertTrue(all(item['title'] == 'Hello' for item in results))

    def metadata(self, path='hello.md', headers=None):
        return self.request('GET', '/api/metadata?' + urlencode({'root': self.identifier, 'path': path}), headers=headers)

    def test_title_precedence_and_prefix(self):
        self.assertEqual(catalog.title_from_text('---\ntitle: "Front title"\n---\n# Heading', 'file.md'), 'Front title')
        self.assertEqual(catalog.title_from_text('# Heading\nBody', 'file.md'), 'Heading')
        self.assertEqual(catalog.title_from_text('body', 'file.md'), 'file.md')
        (self.root / 'hello.md').write_text('x' * catalog.TITLE_BYTES + '\n# Too late')
        self.assertEqual(json.loads(self.metadata()[1])['title'], 'hello.md')

    def test_metadata_guards_and_confinement(self):
        (self.root / 'alias.md').symlink_to(self.root / 'hello.md')
        (self.root / '.git').mkdir()
        (self.root / '.git/private.md').write_text('secret')
        for path in ['../outside/secret.md', str(self.outside / 'secret.md'), 'alias.md', '.git/private.md']:
            self.assertEqual(self.metadata(path)[0], 404)
        for route in ['/api/catalog?root=' + self.identifier, '/api/metadata?' + urlencode({'root': self.identifier, 'path': 'hello.md'})]:
            for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}, {'Sec-Fetch-Site': 'cross-site', 'Origin': None}]:
                self.assertEqual(self.request('GET', route, headers=headers)[0], 403)
            self.assertEqual(self.request('GET', route)[0], 200)
            self.assertEqual(self.response_headers.get('X-Content-Type-Options'), 'nosniff')

    def test_metadata_shared_target_confinement(self):
        from pathlib import Path
        original = Path.resolve
        def redirect(path, *arguments, **options):
            if path == self.root / 'hello.md':
                return self.outside / 'secret.md'
            return original(path, *arguments, **options)
        with patch.object(Path, 'resolve', redirect):
            self.assertEqual(self.metadata()[0], 404)

    def test_metadata_caps_and_source_immutability(self):
        original = (self.root / 'hello.md').read_bytes()
        for index in range(6):
            (self.root / f'file{index}.md').write_text('# Synthetic')
        with patch.object(catalog, 'PAGE_SIZE', 2), patch.object(policy, 'MAX_FILES', 3):
            result = json.loads(self.request('GET', '/api/catalog?root=' + self.identifier)[1])
            self.assertEqual(len(result['entries']), 2)
            self.assertEqual(result['next'], 2)
            result = json.loads(self.request('GET', '/api/catalog?root=' + self.identifier + '&offset=2')[1])
            self.assertEqual(len(result['entries']), 1)
            self.assertIsNone(result['next'])
        self.assertEqual(self.request('GET', '/api/catalog?root=' + self.identifier + '&offset=-1')[0], 400)
        with patch.object(policy, 'MAX_FILE_BYTES', 2):
            self.assertEqual(self.metadata()[0], 413)
        self.assertEqual((self.root / 'hello.md').read_bytes(), original)

    def test_metadata_cache_invalidates_and_is_bounded(self):
        catalog.cache.clear()
        first = json.loads(self.metadata()[1])
        self.assertEqual(first['title'], 'Hello')
        (self.root / 'hello.md').write_text('# Changed heading\n')
        second = json.loads(self.metadata()[1])
        self.assertEqual(second['title'], 'Changed heading')
        self.assertNotEqual(first['size'], second['size'])
        with patch.object(catalog, 'CACHE_SIZE', 1):
            (self.root / 'other.md').write_text('# Other')
            self.metadata('other.md')
            self.assertEqual(len(catalog.cache), 1)
