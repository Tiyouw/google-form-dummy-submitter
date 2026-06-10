import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, parseVersion, isNewer } from '../src/update-check.js';

test('parseVersion extracts major, minor, patch', () => {
  assert.deepEqual(parseVersion('1.4.0'), { major: 1, minor: 4, patch: 0 });
  assert.deepEqual(parseVersion('0.1.2'), { major: 0, minor: 1, patch: 2 });
  assert.deepEqual(parseVersion('10.20.30'), { major: 10, minor: 20, patch: 30 });
});

test('parseVersion handles invalid input', () => {
  assert.deepEqual(parseVersion('bad'), { major: 0, minor: 0, patch: 0 });
  assert.deepEqual(parseVersion(''), { major: 0, minor: 0, patch: 0 });
  assert.deepEqual(parseVersion(null), { major: 0, minor: 0, patch: 0 });
});

test('isNewer compares versions correctly', () => {
  assert.equal(isNewer('1.4.0', '1.5.0'), true);
  assert.equal(isNewer('1.4.0', '1.4.1'), true);
  assert.equal(isNewer('1.4.0', '2.0.0'), true);
  assert.equal(isNewer('1.4.0', '1.4.0'), false);
  assert.equal(isNewer('1.5.0', '1.4.0'), false);
  assert.equal(isNewer('2.0.0', '1.9.9'), false);
});

test('checkForUpdate returns null when current is latest', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ version: '1.4.0' }),
  });

  const result = await checkForUpdate({ currentVersion: '1.4.0', timeout: 1000 });
  assert.equal(result, null);
});

test('checkForUpdate returns update info when newer version exists', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ version: '1.5.0' }),
  });

  const result = await checkForUpdate({ currentVersion: '1.4.0', timeout: 1000 });
  assert.notEqual(result, null);
  assert.equal(result.current, '1.4.0');
  assert.equal(result.latest, '1.5.0');
});

test('checkForUpdate returns null on network error (silent fail)', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => { throw new Error('network error'); };

  const result = await checkForUpdate({ currentVersion: '1.4.0', timeout: 1000 });
  assert.equal(result, null);
});

test('checkForUpdate returns null on timeout', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Promise((resolve) => setTimeout(resolve, 5000));

  const result = await checkForUpdate({ currentVersion: '1.4.0', timeout: 100 });
  assert.equal(result, null);
});
