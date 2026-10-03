import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('release history tolerates media bytes without exempting their text', () => {
  const script = `import runpy\nfrom unittest.mock import patch\nm=runpy.run_path('tools/pre-publish-check')\nwith patch('subprocess.check_output', return_value=b'\\xffprivate'):\n assert m['git']('cat-file', '-p', 'example') == '\\ufffdprivate'\nassert m['violations'](b'\\xffAKIAAAAAAAAAAAAAAAAA'.decode(errors='replace'))`;
  assert.equal(execFileSync('python3', ['-c', script]).toString(), '');
});

test('pre-publish scanner rejects private paths, secrets and personal mailboxes', () => {
  const script = `import runpy\nm=runpy.run_path('tools/pre-publish-check')\nassert m['violations']('/'+'Users'+'/example/private')\nassert m['violations']('person'+'@gmail.com')\nassert m['violations']('AKIA'+'A'*16)\nassert not m['violations']('Synthetic public documentation')`;
  assert.equal(execFileSync('python3', ['-c', script]).toString(), '');
});
