import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bin = join(root, 'bin', 'gformdummy.js');

test('CLI --help prints usage and key options', () => {
  const result = spawnSync(process.execPath, [bin, '--help'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--form-url/);
  assert.match(result.stdout, /--csv/);
  assert.match(result.stdout, /--submit/);
});
