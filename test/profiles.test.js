import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import {
  loadProfiles,
  saveProfile,
  deleteProfile,
  getProfile,
  mergeProfileWithArgs,
} from '../src/profiles.js';

const TEST_CONFIG_PATH = '/tmp/gformdummy-profiles-test.json';

async function clean() {
  try {
    await unlink(TEST_CONFIG_PATH);
  } catch {}
}

describe('profiles', () => {
  beforeEach(clean);

  it('returns empty array when no profiles exist', async () => {
    const profiles = await loadProfiles({ configPath: TEST_CONFIG_PATH });
    assert.deepEqual(profiles, []);
  });

  it('saves and retrieves a profile with defaults', async () => {
    await saveProfile(
      { name: 'demo', formUrl: 'https://example.com/form', csvPath: './data.csv' },
      { configPath: TEST_CONFIG_PATH },
    );
    const profiles = await loadProfiles({ configPath: TEST_CONFIG_PATH });
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, 'demo');
    assert.equal(profiles[0].formUrl, 'https://example.com/form');
    assert.equal(profiles[0].csvPath, './data.csv');
    assert.equal(profiles[0].mode, 'dry-run');
    assert.equal(profiles[0].delay, 0.8);
  });

  it('updates existing profile by name', async () => {
    await saveProfile({ name: 'demo', formUrl: 'https://a.com', csvPath: './a.csv' }, { configPath: TEST_CONFIG_PATH });
    await saveProfile({ name: 'demo', formUrl: 'https://b.com', csvPath: './b.csv' }, { configPath: TEST_CONFIG_PATH });
    const profiles = await loadProfiles({ configPath: TEST_CONFIG_PATH });
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].formUrl, 'https://b.com');
  });

  it('deletes a profile', async () => {
    await saveProfile({ name: 'demo', formUrl: 'https://example.com/form', csvPath: './data.csv' }, { configPath: TEST_CONFIG_PATH });
    const ok = await deleteProfile('demo', { configPath: TEST_CONFIG_PATH });
    assert.equal(ok, true);
    const profiles = await loadProfiles({ configPath: TEST_CONFIG_PATH });
    assert.equal(profiles.length, 0);
  });

  it('returns false when deleting nonexistent profile', async () => {
    const ok = await deleteProfile('nope', { configPath: TEST_CONFIG_PATH });
    assert.equal(ok, false);
  });

  it('getProfile finds profile by name', () => {
    const profiles = [{ name: 'a', formUrl: 'https://a.com' }, { name: 'b', formUrl: 'https://b.com' }];
    const p = getProfile('b', profiles);
    assert.equal(p.formUrl, 'https://b.com');
    assert.equal(getProfile('c', profiles), null);
  });

  it('mergeProfileWithArgs overrides profile with explicit args', () => {
    const profile = { name: 'demo', formUrl: 'https://a.com', csvPath: './a.csv', limit: 5 };
    const args = { csvPath: './b.csv' };
    const merged = mergeProfileWithArgs(profile, args);
    assert.equal(merged.formUrl, 'https://a.com');
    assert.equal(merged.csvPath, './b.csv');
    assert.equal(merged.limit, 5);
  });

  it('mergeProfileWithArgs ignores undefined/null args', () => {
    const profile = { name: 'demo', formUrl: 'https://a.com', csvPath: './a.csv', limit: 5 };
    const args = { limit: null, mode: undefined, csvPath: './b.csv' };
    const merged = mergeProfileWithArgs(profile, args);
    assert.equal(merged.limit, 5);
    assert.equal(merged.mode, undefined);
    assert.equal(merged.csvPath, './b.csv');
  });
});
