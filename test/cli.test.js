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

test('CLI --interactive in non-TTY without required args prints guidance and exits 1', () => {
  const result = spawnSync(process.execPath, [bin, '--interactive'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TERM: 'dumb', FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-interactive environment detected/i);
  assert.match(result.stderr, /--form-url/);
  assert.match(result.stderr, /--csv/);
});

