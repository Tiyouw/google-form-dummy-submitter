const NPM_REGISTRY_URL = 'https://registry.npmjs.org/gformdummy/latest';

export function parseVersion(version) {
  const match = String(version ?? '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function isNewer(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  if (l.major !== c.major) return l.major > c.major;
  if (l.minor !== c.minor) return l.minor > c.minor;
  return l.patch > c.patch;
}

export async function checkForUpdate({ currentVersion, timeout = 2000 } = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const data = await response.json();
    const latest = data?.version;
    if (!latest || !isNewer(currentVersion, latest)) return null;

    return { current: currentVersion, latest };
  } catch {
    return null;
  }
}

export function formatUpdateMessage(update) {
  if (!update) return null;
  return [
    `┌─────────────────────────────────────────────────┐`,
    `│ ⚠  Update tersedia: ${update.current} → ${update.latest}`.padEnd(50) + '│',
    `│    Jalankan: npm update -g gformdummy`.padEnd(50) + '│',
    `└─────────────────────────────────────────────────┘`,
  ].join('\n');
}
