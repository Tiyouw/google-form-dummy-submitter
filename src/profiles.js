import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.gformdummy.json');

const PROFILE_DEFAULTS = {
  mode: 'dry-run',
  limit: null,
  start: 1,
  delay: 0.8,
  jitter: 0.4,
  encoding: 'utf8',
  timeout: 30,
  autoPageHistory: true,
  pageHistoryOverride: '',
  noHeader: false,
  theme: 'sunset',
  retry: 3,
  stopOnError: false,
  mapping: null,
  namePrefix: '',
  previewRows: 3,
};

export async function loadConfig({ configPath = DEFAULT_CONFIG_PATH } = {}) {
  try {
    return JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveConfig(config, { configPath = DEFAULT_CONFIG_PATH } = {}) {
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export async function loadProfiles(options) {
  const config = await loadConfig(options);
  return Array.isArray(config.profiles) ? config.profiles : [];
}

export function getProfile(name, profiles) {
  return profiles.find(p => p.name === name) || null;
}

export async function saveProfile(profile, options) {
  const config = await loadConfig(options);
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const merged = { ...PROFILE_DEFAULTS, ...profile };
  const existingIndex = profiles.findIndex(p => p.name === merged.name);
  if (existingIndex >= 0) {
    profiles[existingIndex] = merged;
  } else {
    profiles.push(merged);
  }
  config.profiles = profiles;
  await saveConfig(config, options);
  return merged;
}

export async function deleteProfile(name, options) {
  const config = await loadConfig(options);
  if (!Array.isArray(config.profiles)) return false;
  const before = config.profiles.length;
  config.profiles = config.profiles.filter(p => p.name !== name);
  if (config.profiles.length === before) return false;
  await saveConfig(config, options);
  return true;
}

export function mergeProfileWithArgs(profile, args) {
  const merged = { ...profile };
  for (const key of Object.keys(args)) {
    const value = args[key];
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }
  return merged;
}
