import json
import unittest
from urllib.parse import urlencode

import test_server


class ShellPolicyTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request

    def test_browse_eligibility_uses_registration_policy_and_guards(self):
        route = '/api/browse?' + urlencode({'path': str(self.root)})
        status, body, unused = self.request('GET', route)
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)['can_register'])
        self.assertEqual(json.loads(body)['registration_error'], '')
        self.workspace.settings = self.root / 'reader-state/roots.json'
        status, body, unused = self.request('GET', route)
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(body)['can_register'])
        self.assertIn('settings directory', json.loads(body)['registration_error'])
        self.assertEqual(self.request('POST', '/api/roots', json.dumps({'path': str(self.root)}))[0], 403)
        for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}, {'Sec-Fetch-Site': 'cross-site'}]:
            self.assertEqual(self.request('GET', route, headers=headers)[0], 403)
