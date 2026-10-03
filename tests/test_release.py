import json
import unittest
from unittest.mock import patch

import test_server
from server import policy, search, reviews, chain


class ReleaseTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def test_search_late_hit_and_deterministic_total(self):
        for index in reversed(range(1200)):
            (self.root / f'{index:04}.md').write_text('late marker' if index == 1190 else 'synthetic small file')
        result = search.search(self.root, 'late marker', phrase=True)
        self.assertEqual([hit['path'] for hit in result['hits']], ['1190.md'])
        self.assertEqual(result['scanned'], 1201)
        self.assertEqual(result['total'], 1201)
        self.assertFalse(result['truncated'])
        with patch.object(search, 'MAX_SCAN', 2):
            self.assertEqual(search.search(self.root, 'synthetic')['hits'][0]['path'], '0000.md')

    def test_search_options_and_actual_byte_boundary(self):
        (self.root / 'hello.md').write_text('alphabet ALPHA alpha')
        self.assertEqual(search.search(self.root, 'alpha', word=True)['hits'][0]['count'], 2)
        with self.assertRaises(policy.Rejected):
            search.search(self.root, 'alpha', scope='invalid')
        (self.root / 'a.md').write_text('x' * 12)
        (self.root / 'b.md').write_text('alpha')
        with patch.object(search, 'MAX_BYTES', 12):
            result = search.search(self.root, 'alpha')
            self.assertTrue(result['truncated'])
            self.assertEqual(result['hits'], [])
            self.assertEqual(result['total'], 3)

    def test_review_version_and_list_cap(self):
        for value in [{'version': 2, 'revision': 0, 'lists': [], 'notes': []},
                      {'version': 1, 'revision': 0, 'lists': [{'name': 'a', 'items': []}] * 21, 'notes': []}]:
            with self.assertRaises(policy.Rejected):
                reviews.validate(self.root, value)
        reviews.validate(self.root, {'version': 1, 'revision': 0, 'lists': [{'name': 'a', 'items': []}] * 20, 'notes': []})

    def test_related_folder_and_chain_limit(self):
        folder = self.root / 'nested'
        folder.mkdir()
        (folder / 'document.md').write_text('---\nrelated: [sibling.md]\n---\nSynthetic')
        (folder / 'sibling.md').write_text('status: accepted\nSynthetic')
        self.assertEqual(chain.chain(self.root, 'nested/document.md'), [{'path': 'nested/sibling.md', 'status': 'accepted'}])
        for index in range(25):
            (folder / f'FAMILY-kind{index}.md').write_text('Synthetic')
        self.assertEqual(len(chain.chain(self.root, 'nested/FAMILY-kind0.md')), 20)

    def test_corrupt_reset_guards_rollback_and_source_immutability(self):
        endpoint = '/api/reviews/reset?root=' + self.identifier
        target = reviews.storage(self.workspace, self.identifier)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b'{corrupt')
        before = (self.root / 'hello.md').read_bytes()
        for headers in [{'Host': 'evil.invalid'}, {'Origin': None}, {'Sec-Fetch-Site': 'cross-site'}]:
            self.assertEqual(self.request('POST', endpoint, '{}', headers)[0], 403)
        self.assertEqual(self.request('POST', endpoint, '{"extra":1}')[0], 400)
        with patch.object(reviews.os, 'rename', side_effect=OSError('synthetic failure')):
            self.assertEqual(self.request('POST', endpoint, '{}')[0], 500)
        self.assertEqual(target.read_bytes(), b'{corrupt')
        self.assertEqual(self.request('POST', endpoint, '{}')[0], 200)
        backups = list(target.parent.glob(target.name + '.corrupt-*'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), b'{corrupt')
        self.assertEqual(reviews.load(self.workspace, self.identifier)['revision'], 0)
        self.assertEqual(self.request('POST', endpoint, '{}')[0], 409)
        self.assertEqual((self.root / 'hello.md').read_bytes(), before)
        target.symlink_to(self.root / 'hello.md')
        self.assertEqual(self.request('POST', endpoint, '{}')[0], 403)
