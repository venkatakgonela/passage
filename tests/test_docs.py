import re
import json
import unittest
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent


class DocumentationTests(unittest.TestCase):
    def test_relative_links_and_diagrams(self):
        documents = [*ROOT.glob('*.md'), *sorted((ROOT / 'docs').rglob('*.md')), *sorted((ROOT / '.github').rglob('*.md'))]
        for document in documents:
            text = document.read_text()
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if '://' in target or target.startswith('#'):
                    continue
                self.assertTrue((document.parent / unquote(target.split('#')[0])).exists(), f'{document.name}: {target}')
            for diagram in re.findall(r'```mermaid\n(.*?)```', text, re.S):
                self.assertTrue(diagram.strip(), document.name)
            self.assertEqual(text.count('```mermaid'), len(re.findall(r'```mermaid\n.*?```', text, re.S)), document.name)

    def test_launch_docs_version_and_media(self):
        readme = (ROOT / 'README.md').read_text()
        self.assertLess(len(readme.split()), 600)
        for phrase in ['github.com/venkatakgonela/passage.git', 'Download ZIP', 'python3 -m server', 'py -m server', '60-second quick start', 'Windows', 'untested']:
            self.assertIn(phrase, readme)
        tutorial = (ROOT / 'docs/getting-started.md').read_text()
        self.assertEqual(re.findall(r'^## (\d+)\.', tutorial, re.M), [str(number) for number in range(1, 11)])
        for filename in ['hero', 'dark', 'focus', 'diagrams', 'compare', 'notes', 'lists', 'narrow', 'demo-contact-sheet']:
            self.assertTrue((ROOT / f'docs/images/{filename}.png').is_file())
        package = json.loads((ROOT / 'package.json').read_text())
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        self.assertEqual(package['version'], '0.1.0')
        self.assertEqual(lock['version'], package['version'])
        self.assertEqual(lock['packages']['']['version'], package['version'])
        self.assertIn(f"APP_VERSION = '{package['version']}'", (ROOT / 'web/config.js').read_text())
        security = (ROOT / 'SECURITY.md').read_text()
        self.assertIn('Report a vulnerability', security)
        self.assertNotIn('person who supplied', security)
        self.assertIn('## 0.1.0 — 2026-10-03', (ROOT / 'CHANGELOG.md').read_text())
        for extension, limit in [('mp4', 6000000), ('gif', 5000000)]:
            media = ROOT / f'docs/media/passage-demo.{extension}'
            self.assertGreater(media.stat().st_size, 1000)
            self.assertLess(media.stat().st_size, limit)
            with media.open('rb') as stream:
                header = stream.read(12)
            self.assertTrue(header[4:8] == b'ftyp' if extension == 'mp4' else header[:6] in (b'GIF87a', b'GIF89a'))

    def test_decision_structure(self):
        for decision in (ROOT / 'docs/decisions').glob('[0-9]*.md'):
            text = decision.read_text()
            for heading in ['Context', 'Decision drivers', 'Options considered', 'Decision', 'Consequences', 'Revisit when', 'Sources']:
                self.assertIn('## ' + heading, text)
            self.assertIn(decision.name, (decision.parent / 'README.md').read_text())

    def test_examples_are_synthetic_and_stressful(self):
        for document in (ROOT / 'examples').rglob('*.md'):
            self.assertIn('synthetic', document.read_text().lower())
        stress = (ROOT / 'examples/stress.md').read_text()
        self.assertIn('X' * 200, stress)
        self.assertIn('Column 12', stress)
        self.assertIn('sequenceDiagram', stress)
        self.assertIn('erDiagram', stress)
        self.assertIn('flowchart TD', stress)
        self.assertTrue(any(len(line.removeprefix('## ')) == 70 for line in stress.splitlines() if line.startswith('## ')))
