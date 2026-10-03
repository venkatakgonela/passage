import contextlib
import io
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch


CHECKER = runpy.run_path(str(Path(__file__).resolve().parent.parent / 'tools/pre-publish-check'))
PERSONAL_EMAIL = '60929222+venkatakgonela@users.noreply.github.com'
BOT_EMAIL = '49699333+dependabot[bot]@users.noreply.github.com'


class PublicationIdentityTests(unittest.TestCase):
    def check_history(self, author=PERSONAL_EMAIL, name='GitHub', email='noreply@github.com', message='fix: synthetic', content='Synthetic public documentation'):
        def git(*arguments):
            if arguments == ('ls-files',):
                return 'LICENSE\nTHIRD-PARTY-NOTICES.md\nSECURITY.md\nCONTRIBUTING.md\n'
            if arguments == ('rev-list', 'HEAD'):
                return 'synthetic-commit\n'
            if arguments == ('show', '-s', '--format=%ae%n%cn%n%ce%n%B', 'synthetic-commit'):
                return '\n'.join([author, name, email, message])
            if arguments == ('ls-tree', '-r', 'synthetic-commit'):
                return '100644 blob synthetic-blob\tdocument.md\n'
            if arguments == ('cat-file', '-p', 'synthetic-blob'):
                return content
            self.fail('unexpected git arguments: ' + repr(arguments))
        output = io.StringIO()
        with patch.dict(CHECKER['main'].__globals__, {'git': git}), patch('subprocess.run') as docs, contextlib.redirect_stdout(output):
            docs.return_value.returncode = 0
            failed = CHECKER['main']()
        return failed, output.getvalue()

    def test_all_allowed_author_committer_combinations(self):
        for author in [PERSONAL_EMAIL, BOT_EMAIL]:
            for name, email in [('Venkata K Gonela', PERSONAL_EMAIL), ('GitHub', 'noreply@github.com')]:
                with self.subTest(author=author, name=name, email=email):
                    failed, output = self.check_history(author, name, email)
                    self.assertFalse(failed, output)

    def test_unapproved_authors_fail(self):
        for author in [PERSONAL_EMAIL + '.evil', BOT_EMAIL + '.evil', BOT_EMAIL.replace('49699333', '49699334'),
                       'other[bot]@users.noreply.github.com', 'noreply@github.com', 'synthetic' + '@gmail.com', '', PERSONAL_EMAIL.upper()]:
            with self.subTest(author=author):
                failed, output = self.check_history(author=author)
                self.assertTrue(failed)
                self.assertIn('identity: synthetic-commit', output)

    def test_unapproved_committer_addresses_fail(self):
        for email in ['noreply@github.com.evil', 'noreply@github.co', PERSONAL_EMAIL + '.evil',
                      BOT_EMAIL, 'other[bot]@users.noreply.github.com', 'synthetic' + '@gmail.com', '', 'NOREPLY@github.com']:
            with self.subTest(email=email):
                failed, output = self.check_history(email=email)
                self.assertTrue(failed)
                self.assertIn('identity: synthetic-commit', output)

    def test_github_committer_name_must_match_exactly(self):
        for name in ['Other', 'github', 'GitHub ', ' GitHub', 'GitHub[bot]', '']:
            with self.subTest(name=name):
                failed, output = self.check_history(name=name)
                self.assertTrue(failed)
                self.assertIn('identity: synthetic-commit', output)

    def test_allowed_identity_does_not_exempt_commit_messages(self):
        for message in ['synthetic' + '@gmail.com', 'fix: public\n\n' + 'AKIA' + 'A' * 16]:
            with self.subTest(message=message):
                failed, output = self.check_history(author=BOT_EMAIL, message=message)
                self.assertTrue(failed)
                self.assertIn('commit message: synthetic-commit', output)
                self.assertNotIn('identity: synthetic-commit', output)

    def test_allowed_identity_does_not_exempt_history_content(self):
        failed, output = self.check_history(author=BOT_EMAIL, content='synthetic' + '@gmail.com')
        self.assertTrue(failed)
        self.assertIn('history synthet document.md: personal mailbox', output)
        self.assertNotIn('identity: synthetic-commit', output)
