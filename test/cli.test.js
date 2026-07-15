import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { saveProfile } from '../src/profiles.js';
import { unlink } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bin = join(root, 'bin', 'gformdummy.js');

const TEST_CONFIG = '/tmp/gformdummy-cli-test.json';

beforeEach(async () => {
  try { await unlink(TEST_CONFIG); } catch {}
});

function run(argv) {
  return spawnSync(process.execPath, [bin, ...argv], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
}

test('CLI --help prints usage and key options', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--form-url/);
  assert.match(result.stdout, /--csv/);
  assert.match(result.stdout, /--submit/);
  assert.match(result.stdout, /--profile/);
  assert.match(result.stdout, /profile --list/);
});

test('CLI --interactive in non-TTY without required args prints guidance and exits 1', () => {
  const result = run(['--interactive']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-interactive environment detected/i);
  assert.match(result.stderr, /--form-url/);
  assert.match(result.stderr, /--csv/);
});

test('CLI profile --list prints empty list when no profiles', () => {
  const result = run(['profile', '--list', '--config', TEST_CONFIG]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /belum ada profile/i);
});

test('CLI profile --save stores a profile', () => {
  const result = run([
    'profile',
    '--save', 'demo',
    '--form-url', 'https://docs.google.com/forms/d/e/TEST/viewform',
    '--csv', './data.csv',
    '--config', TEST_CONFIG,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /profile tersimpan/i);
});

test('CLI profile --load reports missing profile', () => {
  const result = run(['profile', '--load', 'missing', '--config', TEST_CONFIG]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Profile tidak ditemukan/i);
});

test('CLI --profile reports missing profile', () => {
  const result = run(['--profile', 'missing', '--config', TEST_CONFIG]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Profile tidak ditemukan/i);
});

