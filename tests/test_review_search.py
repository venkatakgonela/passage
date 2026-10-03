import copy
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.parse import urlencode

import test_server
from server import chain, policy, reviews, search


class ReviewSearchTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def payload(self):
        anchor = {'path': 'hello.md', 'heading': 'hello', 'snippet': 'needle', 'offset': 0}
        return {'version': 1, 'revision': 0, 'lists': [{'name': 'Reading', 'items': [anchor]}], 'notes': [{'anchor': anchor, 'text': 'Synthetic note'}]}

    def endpoint(self):
        return '/api/reviews?root=' + self.identifier

    def write(self, value=None, headers=None):
        before = {path: path.read_bytes() for path in self.root.rglob('*.md') if not path.is_symlink()}
        result = self.request('POST', self.endpoint(), json.dumps(value if value is not None else self.payload()), headers)
        self.assertEqual({path: path.read_bytes() for path in self.root.rglob('*.md') if not path.is_symlink()}, before)
        return result

    def test_review_roundtrip_missing_and_immutable_operations(self):
        self.assertEqual(json.loads(self.request('GET', self.endpoint())[1])['revision'], 0)
        result = self.write()
        self.assertEqual(result[0], 200)
        saved = json.loads(result[1])
        self.assertEqual(saved['revision'], 1)
        self.assertEqual(json.loads(self.request('GET', self.endpoint())[1]), saved)
        saved['lists'][0]['name'] = 'Renamed'
        saved['lists'][0]['items'].append({'path': 'missing.md', 'heading': '', 'snippet': '', 'offset': 0})
        saved = json.loads(self.write(saved)[1])
        saved['lists'][0]['items'].reverse()
        saved = json.loads(self.write(saved)[1])
        saved['lists'] = []
        saved['notes'] = []
        self.assertEqual(self.write(saved)[0], 200)
        self.assertFalse(list(self.root.glob('*.json')))

    def test_write_guards(self):
        for headers in [{'Host': 'evil.invalid'}, {'Origin': None}, {'Origin': 'null'},
                        {'Origin': f'http://localhost:{self.port}'}, {'Sec-Fetch-Site': 'cross-site'},
                        {'Sec-Fetch-Site': 'same-site'}, {'Sec-Fetch-Site': 'none'}]:
            self.assertEqual(self.write(headers=headers)[0], 403)
        self.assertEqual(self.write(headers={'Sec-Fetch-Site': 'same-origin'})[0], 200)
        self.assertEqual(self.request('POST', '/api/reviews?root=unknown', json.dumps(self.payload()))[0], 404)
        self.assertEqual(self.request('GET', '/api/reviews?root=unknown')[0], 404)
        self.assertEqual(self.request('GET', self.endpoint(), headers={'Sec-Fetch-Site': 'cross-site'})[0], 403)

    def test_new_read_routes_share_guards_and_caps(self):
        routes = [self.endpoint(), '/api/chain?' + urlencode({'root': self.identifier, 'path': 'hello.md'}),
                  '/api/search?' + urlencode({'root': self.identifier, 'q': 'needle', 'format': 'details'})]
        for route in routes:
            for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}, {'Sec-Fetch-Site': 'cross-site'}]:
                self.assertEqual(self.request('GET', route, headers=headers)[0], 403)
            self.assertEqual(self.request('GET', route)[0], 200)
            self.assertEqual(self.response_headers['X-Content-Type-Options'], 'nosniff')
        with patch.object(policy, 'MAX_FILE_BYTES', 2):
            self.assertEqual(search.search(self.root, 'needle')['hits'], [])
        with self.assertRaises(policy.Rejected):
            search.search(self.root, 'x' * 201)

    def test_review_boundary_values_and_restart(self):
        value = self.payload()
        value['notes'][0]['text'] = 'x' * 4000
        value['notes'][0]['anchor']['heading'] = 'x' * 200
        value['notes'][0]['anchor']['snippet'] = 'x' * 300
        value['lists'][0]['name'] = 'x' * 100
        value['lists'][0]['items'] *= 200
        self.assertEqual(self.write(value)[0], 200)
        fresh = policy.Workspace(self.home, [self.root], self.settings)
        self.assertEqual(reviews.load(fresh, self.identifier)['notes'][0]['text'], 'x' * 4000)

    def test_schema_limits_and_confinement(self):
        original = self.payload()
        bad_values = [[], {}, {**original, 'unknown': 1}, {**original, 'version': True},
                      {**original, 'revision': -1}, {**original, 'lists': [{}] * 21},
                      {**original, 'notes': original['notes'] * 201},
                      {**original, 'lists': [{'name': 'A', 'items': original['lists'][0]['items'] * 201}]}]
        for field, value in [('text', 'x' * 4001), ('text', ''), ('extra', 1)]:
            bad = copy.deepcopy(original)
            bad['notes'][0][field] = value
            bad_values.append(bad)
        (self.root / 'link.md').symlink_to(self.outside / 'secret.md')
        for path in ['../outside/secret.md', str(self.outside / 'secret.md'), 'link.md', '.git/secret.md', 'bad.txt', 'a\\b.md']:
            bad = copy.deepcopy(original)
            bad['notes'][0]['anchor']['path'] = path
            bad_values.append(bad)
        for field, value in [('heading', 'x' * 201), ('snippet', 'x' * 301), ('offset', -1), ('offset', float('nan')), ('offset', True)]:
            bad = copy.deepcopy(original)
            bad['notes'][0]['anchor'][field] = value
            bad_values.append(bad)
        for value in bad_values:
            self.assertEqual(self.write(value)[0], 400, repr(value)[:100])
        self.assertEqual(self.request('POST', self.endpoint(), '', {'Content-Length': str(reviews.MAX_BYTES + 1)})[0], 413)
        self.assertEqual(self.request('POST', self.endpoint(), '{broken')[0], 400)
        self.assertFalse(reviews.storage(self.workspace, self.identifier).exists())

    def test_atomic_failure_and_concurrent_revision_conflict(self):
        first = json.loads(self.write()[1])
        target = reviews.storage(self.workspace, self.identifier)
        previous = target.read_bytes()
        with patch.object(reviews.os, 'replace', side_effect=OSError('synthetic failure')):
            self.assertEqual(self.write(first)[0], 500)
        self.assertEqual(target.read_bytes(), previous)
        self.assertEqual(list(target.parent.glob('.review-*')), [])
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda unused: self.write(first)[0], range(2)))
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(json.loads(target.read_bytes())['revision'], 2)

    def test_settings_location_and_canonical_confinement(self):
        target = reviews.storage(self.workspace, self.identifier)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(self.root / 'hello.md')
        self.assertEqual(self.write()[0], 403)
        target.unlink()
        from pathlib import Path
        original = Path.resolve
        def redirect(path, *arguments, **options):
            return self.outside / 'secret.md' if path == self.root / 'hello.md' else original(path, *arguments, **options)
        with patch.object(Path, 'resolve', redirect):
            self.assertEqual(self.write()[0], 400)

    def test_search_semantics_scopes_ranking_and_budgets(self):
        (self.root / 'folder').mkdir()
        (self.root / 'folder/a.md').write_text('Alpha beta\nAlpha\nBeta\nalphabet')
        (self.root / 'Alpha beta.md').write_text('synthetic')
        query = lambda **options: search.search(self.root, 'Alpha beta', **options)
        self.assertEqual(query()['hits'][0]['path'], 'Alpha beta.md')
        self.assertEqual(len(query(scope='document', path='folder/a.md', phrase=True, case=True)['hits']), 1)
        self.assertEqual(search.search(self.root, 'alpha beta', scope='document', path='folder/a.md', phrase=True, case=True)['hits'], [])
        self.assertEqual([hit['path'] for hit in query(scope='folder', path='folder/a.md')['hits']], ['folder/a.md'])
        self.assertEqual(search.search(self.root, 'alphabet', word=True)['hits'][0]['count'], 1)
        self.assertEqual(search.search(self.root, 'alph', word=True)['hits'], [])
        with patch.object(search, 'MAX_SCAN', 1):
            result = query()
            self.assertEqual(result['scanned'], 1)
            self.assertTrue(result['truncated'])
        with patch.object(search, 'MAX_ENTRIES', 1):
            self.assertTrue(query()['truncated'])
        with patch.object(search, 'MAX_BYTES', 1):
            self.assertTrue(query()['truncated'])
        with patch.object(policy, 'MAX_HITS', 1):
            self.assertEqual(len(query()['hits']), 1)
            self.assertTrue(query()['truncated'])
        for options in [{'scope': 'other'}, {'scope': 'document', 'path': '../outside/secret.md'}]:
            with self.assertRaises(policy.Rejected):
                query(**options)
        self.assertEqual(self.request('GET', '/api/search?' + urlencode({'root': self.identifier, 'q': 'needle', 'format': 'details'}))[0], 200)

    def test_chain_pure_rules_head_limit_and_route(self):
        self.assertEqual(chain.family('folder/SAMPLE-plan.md'), chain.family('folder/SAMPLE-review.md'))
        self.assertNotEqual(chain.family('other/SAMPLE-plan.md'), chain.family('folder/SAMPLE-plan.md'))
        self.assertIsNone(chain.family('README.md'))
        self.assertEqual(chain.metadata('---\nrelated: ["hello.md", other.md]\n---\nstatus: ready')['related'], ['hello.md', 'other.md'])
        self.assertEqual(chain.metadata('---\nrelated:\n  - hello.md\n  - other.md\n---')['related'], ['hello.md', 'other.md'])
        (self.root / 'SAMPLE-plan.md').write_text('---\nrelated: [hello.md, ../outside/secret.md]\n---\nstatus: ready\n# Synthetic')
        (self.root / 'SAMPLE-report.md').write_text('x' * chain.TITLE_BYTES + '\nverdict: late')
        result = chain.chain(self.root, 'SAMPLE-plan.md')
        self.assertEqual([item['path'] for item in result], ['SAMPLE-plan.md', 'SAMPLE-report.md', 'hello.md'])
        self.assertEqual(result[1]['status'], '')
        self.assertEqual(chain.chain(self.root, 'hello.md'), [])
        self.assertEqual(self.request('GET', '/api/chain?' + urlencode({'root': self.identifier, 'path': '../outside/secret.md'}))[0], 404)
