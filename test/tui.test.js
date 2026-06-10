import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';
import { GformTui } from '../src/tui/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bin = join(root, 'bin', 'gformdummy.js');

test('CLI default run without args in non-TTY prints guidance and exits 1', () => {
  const result = spawnSync(process.execPath, [bin], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TERM: 'dumb', FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-interactive environment detected/i);
  assert.match(result.stderr, /--form-url/);
  assert.match(result.stderr, /--csv/);
});

test('GformTui renders welcome header and step bar', () => {
  const { lastFrame } = render(React.createElement(GformTui));
  const output = lastFrame();
  assert.match(output, /Google Form Dummy Submitter/i);
  assert.match(output, /Form URL/i);
  assert.match(output, /CSV Path/i);
  assert.match(output, /Mode/i);
});

test('GformTui shows URL input step initially', () => {
  const { lastFrame } = render(React.createElement(GformTui));
  const output = lastFrame();
  assert.match(output, /Google Form URL/i);
  assert.match(output, /Masukkan URL public Google Form/i);
});

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

test('CLI --version prints version', () => {
  const result = spawnSync(process.execPath, [bin, '--version'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /1\.5\.0/);
});
