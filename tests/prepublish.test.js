import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('pre-publish scanner rejects private paths, secrets and personal mailboxes', () => {
  const script = `import runpy\nm=runpy.run_path('tools/pre-publish-check')\nassert m['violations']('/'+'Users'+'/example/private')\nassert m['violations']('person'+'@gmail.com')\nassert m['violations']('AKIA'+'A'*16)\nassert not m['violations']('Synthetic public documentation')`;
  assert.equal(execFileSync('python3', ['-c', script]).toString(), '');
});
