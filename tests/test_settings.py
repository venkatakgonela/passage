import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server.settings import default_settings
from server import policy, reviews, search


class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name).resolve()
        self.home = self.base / 'home'
        self.project = self.home / 'checkout'
        self.legacy = self.project / '.state'
        self.legacy.mkdir(parents=True)

    def tearDown(self):
        self.temporary.cleanup()

    def test_default_location_and_one_time_non_destructive_migration(self):
        original = b'["synthetic"]'
        (self.legacy / 'roots.json').write_bytes(original)
        (self.legacy / 'reviews-example.json').write_bytes(b'{"synthetic":true}')
        target = default_settings(self.project, self.home, {})
        self.assertEqual(target, self.home / '.config/passage/roots.json')
        self.assertEqual(target.read_bytes(), original)
        self.assertEqual((target.parent / 'reviews-example.json').read_bytes(), b'{"synthetic":true}')
        self.assertEqual((self.legacy / 'roots.json').read_bytes(), original)
        target.write_bytes(b'[]')
        (self.legacy / 'reviews-later.json').write_text('later')
        default_settings(self.project, self.home, {})
        self.assertEqual(target.read_bytes(), b'[]')
        self.assertFalse((target.parent / 'reviews-later.json').exists())
        workspace = policy.Workspace(self.home, [self.project], target)
        self.assertIn(self.project, workspace.roots)
        with self.assertRaisesRegex(policy.Rejected, 'settings directory'):
            workspace.folder(self.home)
        with self.assertRaises(policy.Rejected):
            workspace.folder(target.parent)

    def test_xdg_override_existing_destination_and_symlinks(self):
        config = self.base / 'config'
        destination = config / 'passage'
        destination.mkdir(parents=True)
        (destination / 'roots.json').write_text('[]')
        (self.legacy / 'roots.json').write_text('["old"]')
        (self.legacy / 'reviews-alias.json').symlink_to(self.legacy / 'roots.json')
        target = default_settings(self.project, self.home, {'XDG_CONFIG_HOME': str(config)})
        self.assertEqual(target, destination / 'roots.json')
        self.assertEqual(target.read_text(), '[]')
        self.assertFalse((destination / 'reviews-alias.json').exists())
        override = self.base / 'override/roots.json'
        self.assertEqual(default_settings(self.project, self.home, {'READER_SETTINGS': str(override)}), override)
        self.assertFalse(override.parent.exists())
        self.assertEqual(default_settings(self.project, self.home, {'XDG_CONFIG_HOME': 'relative'}), self.home / '.config/passage/roots.json')

    def test_reset_rethrows_non_corruption_from_load_without_moving(self):
        target = self.base / 'settings/roots.json'
        workspace = policy.Workspace(self.home, [self.project], target)
        identifier = policy.root_id(self.project)
        review = reviews.storage(workspace, identifier)
        review.parent.mkdir()
        review.write_bytes(b'{bad')
        for status in [403, 404, 409]:
            with patch.object(reviews, 'load', side_effect=policy.Rejected('not corruption', status)), patch.object(reviews.os, 'rename') as rename:
                with self.assertRaises(policy.Rejected) as raised:
                    reviews.reset_corrupt(workspace, identifier, {})
                self.assertEqual(raised.exception.status, status)
                rename.assert_not_called()
            self.assertEqual(review.read_bytes(), b'{bad')

    def test_failed_migration_preserves_source_and_can_retry(self):
        source = self.legacy / 'roots.json'
        source.write_bytes(b'[]')
        destination = self.home / '.config/passage'
        with patch('server.settings.os.link', side_effect=OSError('synthetic write failure')):
            with self.assertRaises(OSError):
                default_settings(self.project, self.home, {})
        self.assertEqual(source.read_bytes(), b'[]')
        self.assertEqual(list(destination.iterdir()), [])
        self.assertEqual(default_settings(self.project, self.home, {}).read_bytes(), b'[]')

    def test_search_truncated_results_stable_under_changed_enumeration(self):
        for name in ['a.md', 'b.md', 'c.md', 'd.md']:
            (self.project / name).write_text('synthetic marker')
        orders = [['d.md', 'b.md', 'a.md', 'c.md'], ['c.md', 'a.md', 'd.md', 'b.md']]
        results = []
        for order in orders:
            with patch.object(search, 'candidates', return_value=iter(order)), patch.object(search, 'MAX_SCAN', 2):
                results.append(search.search(self.project, 'marker'))
        self.assertEqual(results[0], results[1])
        self.assertEqual([hit['path'] for hit in results[0]['hits']], ['a.md', 'b.md'])
        self.assertTrue(results[0]['truncated'])
        self.assertEqual(results[0]['scanned'], 2)
        original = search.os.scandir
        class OrderedScan:
            def __init__(inner, path, reverse):
                with original(path) as entries:
                    inner.entries = sorted(entries, key=lambda entry: entry.name, reverse=reverse)
            def __enter__(inner):
                return iter(inner.entries)
            def __exit__(inner, *arguments):
                return False
        sequences = []
        for reverse in [False, True]:
            with patch.object(search.os, 'scandir', side_effect=lambda path: OrderedScan(path, reverse)), patch.object(search, 'MAX_ENTRIES', 3):
                sequences.append(list(search.candidates(self.project)))
        self.assertEqual(sequences[0], sequences[1])
