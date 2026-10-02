import re
import unittest
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent


class DocumentationTests(unittest.TestCase):
    def test_relative_links_and_diagrams(self):
        documents = [ROOT / 'README.md', ROOT / 'THIRD-PARTY-NOTICES.md', *sorted((ROOT / 'docs').rglob('*.md'))]
        for document in documents:
            text = document.read_text()
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if '://' in target or target.startswith('#'):
                    continue
                self.assertTrue((document.parent / unquote(target.split('#')[0])).exists(), f'{document.name}: {target}')
            for diagram in re.findall(r'```mermaid\n(.*?)```', text, re.S):
                self.assertTrue(diagram.strip(), document.name)
            self.assertEqual(text.count('```mermaid'), len(re.findall(r'```mermaid\n.*?```', text, re.S)), document.name)

    def test_decision_structure(self):
        decision = ROOT / 'docs/decisions/0001-folder-authority.md'
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
