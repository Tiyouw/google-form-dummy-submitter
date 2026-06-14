import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { readFile, writeFile, access, readdir, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { getTheme, THEME_NAMES } from '../themes.js';

const VERSION = '1.20.0';
const CONFIG_PATH = join(homedir(), '.gformdummy.json');
const REPORTS_DIR = join(homedir(), '.gformdummy', 'reports');
const MAPPINGS_DIR = join(homedir(), '.gformdummy', 'mappings');
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ── Helpers ──

async function ensureDir(dir) {
  try { await mkdir(dir, { recursive: true }); } catch {}
}

async function loadConfig() {
  try { return JSON.parse(await readFile(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

async function saveConfig(data) {
  try {
    const existing = await loadConfig();
    await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, ...data }, null, 2), 'utf8');
  } catch {}
}

async function saveReport(report) {
  await ensureDir(REPORTS_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(REPORTS_DIR, `run-${ts}.json`);
  await writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

async function loadHistory(limit = 5) {
  try {
    await ensureDir(REPORTS_DIR);
    const files = (await readdir(REPORTS_DIR)).filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit);
    const reports = [];
    for (const f of files) {
      try { reports.push(JSON.parse(await readFile(join(REPORTS_DIR, f), 'utf8'))); } catch {}
    }
    return reports;
  } catch { return []; }
}

async function listCsvFiles(dir = '.') {
  try {
    const entries = await readdir(dir);
    return entries.filter(f => extname(f).toLowerCase() === '.csv');
  } catch { return []; }
}

function validateUrl(url) {
  if (!url.trim()) return { ok: false, msg: 'URL wajib diisi' };
  if (!url.includes('docs.google.com/forms')) return { ok: false, msg: 'Harus URL Google Form (/viewform)' };
  if (!url.includes('/viewform')) return { ok: false, msg: 'URL harus mengandung /viewform' };
  return { ok: true, msg: '✓ URL valid' };
}

async function validateCsv(path) {
  if (!path.trim()) return { ok: false, msg: 'Path CSV wajib diisi' };
  try {
    await access(path.trim());
    const content = await readFile(path.trim(), 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { ok: false, msg: 'CSV harus punya minimal header + 1 baris data' };

    // Detect if first row looks like data (no header)
    const firstCols = lines[0]?.split(',') || [];
    const looksLikeData = firstCols.some(col => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(col)) // date patterns
      || firstCols.every(col => /^\d+$/.test(col.trim())); // all numbers

    const warning = looksLikeData
      ? '⚠ Baris pertama terlihat seperti data. Tekan n di step Options untuk mode --no-header'
      : null;

    return {
      ok: true,
      msg: `✓ Ditemukan ${lines.length - 1} baris data`,
      lines,
      preview: lines.slice(0, 6),
      warning,
    };
  } catch { return { ok: false, msg: 'File tidak ditemukan' }; }
}

// ── UI Components ──

function Header({ theme }) {
  const lines = [
    ' ╔═╗ ╔═╗ ╔═╗ ╦═╗ ╔╦╗ ╔╦╗ ╦ ╦ ╔╦╗ ╔╦╗ ╦ ╦',
    ' ║ ╦ ╠╣  ║ ║ ╠╦╝ ║║║  ║║ ║ ║ ║║║ ║║║ ╚╦╝',
    ' ╚═╝ ╚   ╚═╝ ╩╚═ ╩ ╩ ═╩╝ ╚═╝ ╩ ╩ ╩ ╩  ╩',
  ];
  return React.createElement(
    Box, { flexDirection: 'column', marginBottom: 0, paddingLeft: 2 },
    ...lines.map((line, i) =>
      React.createElement(Text, { key: i, color: theme.logo[i], bold: true }, line),
    ),
    React.createElement(
      Box, { marginTop: 1, paddingLeft: 1 },
      React.createElement(Text, { color: theme.primary, bold: true }, 'Google Form Dummy Submitter'),
      React.createElement(Text, { dimColor: true }, '  by '),
      React.createElement(Text, { color: theme.accent, bold: true }, 'tiyoouw'),
    ),
    React.createElement(
      Box, { paddingLeft: 1 },
      React.createElement(Text, { dimColor: true }, `v${VERSION}`),
      React.createElement(Text, { dimColor: true }, '  ·  '),
      React.createElement(Text, { dimColor: true }, `Theme: ${theme.name}`),
      React.createElement(Text, { dimColor: true }, '  ·  '),
      React.createElement(Text, { dimColor: true }, 'Press Ctrl+C to exit'),
    ),
  );
}

function StepBar({ steps, current, theme }) {
  return React.createElement(
    Box, { marginBottom: 1, paddingLeft: 1 },
    ...steps.map((step, i) => {
      const isActive = step.key === current;
      const isDone = steps.findIndex((s) => s.key === current) > i;
      const color = isActive ? theme.info : isDone ? theme.success : theme.dim;
      const prefix = isDone ? ' ✓ ' : isActive ? ' ▸ ' : '   ';
      const suffix = i < steps.length - 1 ? ' ──' : '';
      return React.createElement(Text, { key: step.key, color, bold: isActive }, `${prefix}${step.label}${suffix}`);
    }),
  );
}

function InputField({ label, value, onChange, onSubmit, placeholder, focus, status, theme }) {
  if (!focus) {
    return React.createElement(
      Box, { paddingLeft: 2 },
      React.createElement(Text, { bold: true, color: 'white' }, `${label}: `),
      React.createElement(Text, { color: value ? theme.success : theme.dim }, value || placeholder),
    );
  }
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 1 },
    React.createElement(Text, { bold: true, color: theme.info }, `▸ ${label}`),
    React.createElement(
      Box, { paddingLeft: 2 },
      React.createElement(Text, { color: 'white' }, '> '),
      React.createElement(TextInput, { value, onChange, onSubmit, placeholder }),
    ),
    status
      ? React.createElement(Text, { color: status.ok ? theme.success : theme.error, paddingLeft: 2 }, status.msg)
      : null,
  );
}

function SelectField({ label, options, value, onChange, focus, theme }) {
  useInput(
    (input, key) => {
      if (!focus) return;
      const idx = options.indexOf(value);
      if (key.upArrow || key.leftArrow) onChange(options[Math.max(0, idx - 1)]);
      else if (key.downArrow || key.rightArrow) onChange(options[Math.min(options.length - 1, idx + 1)]);
    },
    { isActive: focus },
  );
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 1 },
    React.createElement(Text, { bold: true, color: focus ? theme.info : 'white' }, `${focus ? '▸' : ' '} ${label}`),
    ...options.map((opt) => {
      const isActive = opt === value;
      return React.createElement(
        Box, { key: opt, paddingLeft: 3 },
        React.createElement(Text, { color: isActive ? theme.info : theme.dim, bold: isActive }, `${isActive ? '●' : '○'} ${opt}`),
      );
    }),
  );
}

function FilePicker({ files, selectedIndex, onSelect, focus, theme }) {
  useInput(
    (input, key) => {
      if (!focus) return;
      if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
      else if (key.downArrow) onSelect(Math.min(files.length - 1, selectedIndex + 1));
    },
    { isActive: focus },
  );

  if (files.length === 0) {
    return React.createElement(Text, { color: theme.warning, paddingLeft: 2 }, 'Tidak ada file CSV ditemukan di direktori ini');
  }

  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2 },
    React.createElement(Text, { dimColor: true, marginBottom: 1 }, '↑↓ untuk pilih  Enter untuk konfirmasi'),
    ...files.map((f, i) => {
      const isActive = i === selectedIndex;
      return React.createElement(
        Box, { key: f, paddingLeft: 1 },
        React.createElement(Text, { color: isActive ? theme.info : 'white', bold: isActive }, `${isActive ? '▸' : ' '} ${f}`),
      );
    }),
  );
}

function BoxPanel({ children, title, theme, width = 80 }) {
  return React.createElement(
    Box, { flexDirection: 'column', borderStyle: 'round', borderColor: theme.border, paddingLeft: 1, paddingRight: 1, width },
    title ? React.createElement(Box, { marginBottom: 0 }, React.createElement(Text, { bold: true, color: theme.info }, ` ${title} `)) : null,
    children,
  );
}

function Spinner({ text, theme }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % SPIN_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, []);
  return React.createElement(Text, { color: theme.info }, `${SPIN_FRAMES[frame]} ${text}`);
}

function CsvPreview({ rows, theme }) {
  const [showAll, setShowAll] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput(
    (input, key) => {
      if (key.upArrow) setScrollOffset(o => Math.max(0, o - 1));
      else if (key.downArrow) setScrollOffset(o => Math.min(Math.max(0, (rows?.length || 1) - 2), o + 1));
      else if (input === 'a' || input === 'A') setShowAll(!showAll);
    },
    { isActive: true },
  );

  if (!rows || rows.length === 0) return null;
  const headers = rows[0]?.split(',').map(h => h.trim()) || [];
  const allDataRows = rows.slice(1);

  // Limit to 8 columns max, truncate header names
  const maxCols = Math.min(headers.length, 8);
  const displayHeaders = headers.slice(0, maxCols).map(h => h.length > 14 ? h.slice(0, 12) + '..' : h);
  const colWidth = 14;

  const truncate = (s) => {
    const t = String(s ?? '').trim();
    return t.length > colWidth ? t.slice(0, colWidth - 2) + '..' : t;
  };

  const visibleRows = showAll ? allDataRows : allDataRows.slice(scrollOffset, scrollOffset + 5);
  const headerLine = displayHeaders.map(h => h.padEnd(colWidth)).join('');
  const separator = displayHeaders.map(() => '─'.repeat(colWidth)).join('');

  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
    React.createElement(Text, { bold: true, color: theme.warning }, `📋 Preview CSV (${allDataRows.length} rows):`),
    React.createElement(Text, { color: theme.info, bold: true }, headerLine),
    React.createElement(Text, { dimColor: true }, separator),
    ...visibleRows.map((row, i) => {
      const cols = row.split(',').slice(0, maxCols).map(c => truncate(c).padEnd(colWidth));
      return React.createElement(Text, { key: i, color: 'white' }, cols.join(''));
    }),
    !showAll && allDataRows.length > 5
      ? React.createElement(Text, { dimColor: true, italic: true, marginTop: 0 }, `  ↑↓ scroll · a show all (${allDataRows.length - 5} more rows)`)
      : null,
    showAll
      ? React.createElement(Text, { dimColor: true, italic: true }, '  a to collapse')
      : null,
  );
}

function SavedConfigPrompt({ configs, onSelect, onSkip, theme }) {
  useInput(
    (input, key) => {
      if (input === 'n' || input === 'N') onSkip();
      const num = parseInt(input, 10);
      if (num >= 1 && num <= configs.length) onSelect(configs[num - 1]);
    },
    { isActive: true },
  );
  return React.createElement(
    BoxPanel, { title: '📂 Saved Configs', theme },
    React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih config tersimpan atau tekan N untuk mulai baru:'),
    ...configs.map((cfg, i) =>
      React.createElement(
        Box, { key: i, paddingLeft: 2 },
        React.createElement(Text, { color: theme.info, bold: true }, `[${i + 1}] `),
        React.createElement(Text, { color: 'white' }, cfg.name || cfg.formUrl?.slice(0, 60) || `Config ${i + 1}`),
      ),
    ),
    React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Tekan nomor atau N untuk baru'),
  );
}

function HistoryPanel({ history, theme }) {
  if (history.length === 0) return null;
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
    React.createElement(Text, { bold: true, color: theme.warning }, '📜 Recent Runs:'),
    ...history.slice(0, 3).map((r, i) =>
      React.createElement(
        Box, { key: i, paddingLeft: 1 },
        React.createElement(Text, { color: r.ok ? theme.success : theme.error }, r.ok ? '✓' : '✗'),
        React.createElement(Text, { dimColor: true }, ` ${r.mode?.toUpperCase() || '?'} `),
        React.createElement(Text, { color: 'white' }, `${r.rows || '?'} rows`),
        React.createElement(Text, { dimColor: true }, ` ${r.timestamp ? new Date(r.timestamp).toLocaleString('id-ID') : '-'}`),
      ),
    ),
  );
}

function ThemePicker({ themes, selectedIndex, onSelect, focus, theme }) {
  useInput(
    (input, key) => {
      if (!focus) return;
      if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
      else if (key.downArrow) onSelect(Math.min(themes.length - 1, selectedIndex + 1));
    },
    { isActive: focus },
  );

  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2 },
    ...themes.map((t, i) => {
      const isActive = i === selectedIndex;
      const themeObj = getTheme(t);
      return React.createElement(
        Box, { key: t, paddingLeft: 1 },
        React.createElement(Text, { color: isActive ? theme.info : 'white', bold: isActive }, `${isActive ? '▸' : ' '} `),
        React.createElement(Text, { color: themeObj.logo[0], bold: true }, themeObj.name),
        React.createElement(Text, { dimColor: true }, ` — ${themeObj.description}`),
      );
    }),
  );
}



// ── Mapping helpers ──

function extractFormId(formUrl) {
  const m = formUrl.match(/\/d\/e\/([^/]+)/);
  return m ? m[1].slice(0, 12) : 'unknown';
}

async function loadMapping(formUrl) {
  try {
    const formId = extractFormId(formUrl);
    const files = await readdir(MAPPINGS_DIR);
    const match = files.find(f => f.startsWith(formId));
    if (match) {
      const data = JSON.parse(await readFile(join(MAPPINGS_DIR, match), 'utf8'));
      return data.mapping || null;
    }
  } catch {}
  return null;
}

async function saveMapping(formUrl, mapping) {
  await ensureDir(MAPPINGS_DIR);
  const formId = extractFormId(formUrl);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(MAPPINGS_DIR, `${formId}-${ts}.json`);
  await writeFile(file, JSON.stringify({
    formUrl,
    createdAt: new Date().toISOString(),
    mapping,
  }, null, 2), 'utf8');
  return file;
}

// ── Main TUI Component ──

export function GformTui({ onComplete }) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const [step, setStep] = useState('init');
  const [formUrl, setFormUrl] = useState('');
  const [csvPath, setCsvPath] = useState('');
  const [mode, setMode] = useState('dry-run');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState(null);
  const [urlStatus, setUrlStatus] = useState(null);
  const [csvStatus, setCsvStatus] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [history, setHistory] = useState([]);
  const [csvFiles, setCsvFiles] = useState([]);
  const [csvFileIndex, setCsvFileIndex] = useState(0);
  const [useFilePicker, setUseFilePicker] = useState(false);
  const [themeName, setThemeName] = useState('sunset');
  const [themeIndex, setThemeIndex] = useState(0);
  const [noHeader, setNoHeader] = useState(false);
  const [mapping, setMapping] = useState(null);
  const [savedMapping, setSavedMapping] = useState(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [runStats, setRunStats] = useState(null);
  const [toolResult, setToolResult] = useState(null);
  const [toolRunning, setToolRunning] = useState(false);

  const theme = getTheme(themeName);

  const steps = [
    { key: 'url', label: 'Form URL' },
    { key: 'csv', label: 'CSV Path' },
    { key: 'preview', label: 'Preview' },
    { key: 'mode', label: 'Mode' },
    { key: 'options', label: 'Options' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'tools', label: 'Tools' },
  ];

  // Load config + history + csv files on mount
  useEffect(() => {
    Promise.all([
      loadConfig(),
      loadHistory(5),
      listCsvFiles('.'),
    ]).then(([cfg, hist, csvs]) => {
      setHistory(hist);
      setCsvFiles(csvs);
      // Load saved mapping for this form
      // Will be loaded when form URL is set

      if (cfg.theme) {
        setThemeName(cfg.theme);
        setThemeIndex(THEME_NAMES.indexOf(cfg.theme));
      }
      const recent = cfg.recent || [];
      if (recent.length > 0) {
        setSavedConfigs(recent.slice(0, 5));
        setStep('init');
      } else {
        setStep('url');
      }
    });
  }, []);

  // Validate URL on change
  useEffect(() => {
    if (step === 'url' && formUrl.trim()) setUrlStatus(validateUrl(formUrl));
    else setUrlStatus(null);
  }, [formUrl, step]);

  // Validate CSV on change
  useEffect(() => {
    if (step === 'csv' && csvPath.trim() && !useFilePicker) {
      const timer = setTimeout(async () => {
        const status = await validateCsv(csvPath);
        setCsvStatus(status);
        if (status.ok && status.preview) setCsvPreview(status.preview);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCsvStatus(null);
      setCsvPreview(null);
    }
  }, [csvPath, step, useFilePicker]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') { exit(); return; }
      if (step === 'init') return;

      // Tools menu toggle
      if (input === 'x' || input === 'X') {
        if (step === 'tools') {
          setStep('url');
          setToolResult(null);
        } else {
          setStep('tools');
          setToolResult(null);
        }
        return;
      }

      // Theme picker toggle
      if (input === 't' && !['done', 'confirm'].includes(step)) {
        setShowThemePicker(!showThemePicker);
        return;
      }

      if (step === 'url') {
        if (key.return) {
          const v = validateUrl(formUrl);
          setUrlStatus(v);
          if (v.ok) setStep('csv');
        }
      }

      if (step === 'csv') {
        if (input === 'p' || input === 'P') {
          setUseFilePicker(!useFilePicker);
          return;
        }
        if (key.return && !useFilePicker) {
          validateCsv(csvPath).then((v) => {
            setCsvStatus(v);
            if (v.ok) { if (v.preview) setCsvPreview(v.preview); setStep('preview'); }
          });
        }
        if (key.return && useFilePicker && csvFiles.length > 0) {
          setCsvPath(csvFiles[csvFileIndex]);
          setUseFilePicker(false);
          validateCsv(csvFiles[csvFileIndex]).then((v) => {
            setCsvStatus(v);
            if (v.ok) { if (v.preview) setCsvPreview(v.preview); setStep('preview'); }
          });
        }
        if (input === 'b') setStep('url');
      }

      if (step === 'preview') {
        if (key.return) setStep('mode');
        if (input === 'b') setStep('csv');
      }

      if (step === 'mode') {
        if (key.return) setStep('options');
        if (input === 'b') setStep('preview');
      }

      if (step === 'options') {
        if (key.return) setStep('confirm');
        if (input === 'b') setStep('mode');
        if (input === 'n' || input === 'N') setNoHeader(!noHeader);
      }

      if (step === 'confirm' && !isRunning && !result) {
        if (key.return) handleRun();
        if (input === 'b') setStep('options');
      }

      if (step === 'tools') {
        if (input === '1') handleTemplate();
        if (input === '2') handleGenerate();
        if (input === '3') handleDoctor();
      }

      if (step === 'done') {
        if (input === 'q') {
          if (onComplete) onComplete(result);
          exit();
        }
        if (input === 'r' || input === 'R') {
          setResult(null);
          setRunProgress(null);
          setIsRunning(false);
          setError(null);
          setStep('url');
        }
      }
    },
    { isActive: isRawModeSupported },
  );



  // Tool action handlers
  const handleTemplate = useCallback(async () => {
    if (!formUrl.trim()) { setToolResult({ ok: false, message: 'Form URL wajib diisi dulu' }); return; }
    setToolRunning(true);
    setToolResult(null);
    try {
      const { fields } = await fetchForm(formUrl.trim(), { timeout: 30_000 });
      const headers = ['Timestamp', ...fields.map(f => f.title)];
      const example = fields.map(f => {
        if (f.options.length > 0) return f.options[0];
        if (f.itemType === 9) return '6/14/2026';
        if (f.itemType === 10) return '12:00:00 PM';
        if (f.itemType === 1) return 'Contoh jawaban';
        return 'Contoh';
      });
      const csv = headers.join(',') + '\n' + ['6/14/2026 12:00:00', ...example].join(',') + '\n';
      const outPath = 'template.csv';
      await writeFile(outPath, csv, 'utf8');
      setToolResult({ ok: true, message: `Template saved: ${outPath}\n${fields.length} fields detected` });
    } catch (e) { setToolResult({ ok: false, message: e.message }); }
    setToolRunning(false);
  }, [formUrl]);

  const handleGenerate = useCallback(async () => {
    if (!formUrl.trim()) { setToolResult({ ok: false, message: 'Form URL wajib diisi dulu' }); return; }
    setToolRunning(true);
    setToolResult(null);
    try {
      const { fields } = await fetchForm(formUrl.trim(), { timeout: 30_000 });
      const ID_NAMES = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gilang'];
      const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)];
      const rows = 10;
      const headers = ['Timestamp', ...fields.map(f => f.title)];
      const csvRows = [];
      for (let i = 0; i < rows; i++) {
        const vals = [new Date().toLocaleString('en-US')];
        for (const f of fields) {
          if (f.options.length > 0) vals.push(randomFrom(f.options));
          else if (f.itemType === 9) vals.push('6/14/2026');
          else if (f.itemType === 10) vals.push('12:00:00 PM');
          else if (f.title.toLowerCase().includes('nama')) vals.push(randomFrom(ID_NAMES));
          else vals.push('Contoh ' + (i + 1));
        }
        csvRows.push(vals.map(v => String(v).includes(',') ? '"' + v + '"' : v).join(','));
      }
      const outPath = 'dummy.csv';
      await writeFile(outPath, headers.join(',') + '\n' + csvRows.join('\n') + '\n', 'utf8');
      setToolResult({ ok: true, message: `Dummy data saved: ${outPath}\n${rows} rows, ${fields.length} fields` });
    } catch (e) { setToolResult({ ok: false, message: e.message }); }
    setToolRunning(false);
  }, [formUrl]);

  const handleDoctor = useCallback(async () => {
    setToolRunning(true);
    setToolResult(null);
    const checks = [];
    try {
      const resp = await fetch('https://www.google.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      checks.push('✓ Internet OK');
    } catch { checks.push('✗ No internet'); }
    checks.push('✓ Node.js ' + process.version);
    if (formUrl.trim()) {
      try {
        const { fields } = await fetchForm(formUrl.trim(), { timeout: 15_000 });
        checks.push('✓ Form OK: ' + fields.length + ' fields');
      } catch (e) { checks.push('✗ Form: ' + e.message); }
    }
    if (csvPath.trim()) {
      try {
        const csvText = await readFile(csvPath.trim(), 'utf8');
        const { rows } = parseCsv(csvText);
        checks.push('✓ CSV OK: ' + rows.length + ' rows');
      } catch (e) { checks.push('✗ CSV: ' + e.message); }
    }
    setToolResult({ ok: checks.every(c => c.startsWith('✓')), message: checks.join('\n') });
    setToolRunning(false);
  }, [formUrl, csvPath]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setRunProgress('Mengambil metadata form & memvalidasi CSV...');
    setRunStats(null);
    setError(null);
    try {
      if (onComplete) {
        const config = {
          formUrl: formUrl.trim(),
          csvPath: csvPath.trim(),
          mode,
          submit: mode === 'submit',
          limit: limit.trim() ? parseInt(limit.trim(), 10) : null,
          encoding: 'utf8',
          noHeader,
          mapping: mapping || savedMapping || null,
          autoPageHistory: true,
          pageHistoryOverride: '',
          confirm: true,
          retry: 3,
          stopOnError: false,
        };

        // Save config + theme
        await saveConfig({
          theme: themeName,
          recent: [
            { name: formUrl.trim().slice(0, 60), ...config, savedAt: new Date().toISOString() },
            ...(await loadConfig()).recent || [],
          ].slice(0, 10),
        });

        setRunProgress('Menjalankan...');
        const onProgress = (stats) => {
          setRunStats(stats);
          if (stats.currentName) setRunProgress(`[${stats.current}/${stats.total}] ${stats.currentName}`);
        };
        const runResult = await onComplete(config, onProgress);

        // Save report
        const report = {
          timestamp: new Date().toISOString(),
          formUrl: formUrl.trim(),
          csvPath: csvPath.trim(),
          mode,
          limit: limit.trim() || null,
          ok: runResult?.ok ?? true,
          message: runResult?.message || 'Selesai.',
          rows: csvStatus?.lines?.length ? csvStatus.lines.length - 1 : null,
        };
        const reportPath = await saveReport(report);

        setResult({ ...(runResult || { ok: true, message: 'Selesai.' }), reportPath });
      } else {
        setResult({ ok: true, message: 'Konfigurasi siap. Jalankan dari CLI.' });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }
    setIsRunning(false);
    setRunProgress(null);
    setStep('done');
  }, [formUrl, csvPath, mode, limit, themeName, csvStatus, onComplete]);

  if (!isRawModeSupported) {
    return React.createElement(
      Box, { padding: 1 },
      React.createElement(Text, { color: 'red' }, 'Terminal tidak mendukung raw mode. Gunakan CLI flags.'),
    );
  }

  const handleSelectConfig = (cfg) => {
    if (cfg.formUrl) setFormUrl(cfg.formUrl);
    if (cfg.csvPath) setCsvPath(cfg.csvPath);
    if (cfg.mode) setMode(cfg.mode);
    if (cfg.limit) setLimit(String(cfg.limit));
    setStep('url');
  };

  return React.createElement(
    Box, { flexDirection: 'column', padding: 0 },
    React.createElement(Header, { theme }),
    step !== 'init' ? React.createElement(StepBar, { steps, current: step, theme }) : null,

    // Theme picker overlay
    showThemePicker
      ? React.createElement(
          BoxPanel, { title: '🎨 Pilih Theme', theme },
          React.createElement(ThemePicker, {
            themes: THEME_NAMES, selectedIndex: themeIndex,
            onSelect: (i) => { setThemeIndex(i); setThemeName(THEME_NAMES[i]); },
            focus: true, theme,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, '↑↓ untuk ganti  t untuk tutup'),
        )
      : null,

    // Init
    step === 'init' && savedConfigs.length > 0
      ? React.createElement(SavedConfigPrompt, { configs: savedConfigs, onSelect: handleSelectConfig, onSkip: () => setStep('url'), theme })
      : null,

    // URL
    step === 'url' && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: 'Google Form URL', theme },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan URL public Google Form (/viewform)'),
          React.createElement(InputField, {
            label: 'Form URL', value: formUrl, onChange: setFormUrl,
            onSubmit: () => { const v = validateUrl(formUrl); setUrlStatus(v); if (v.ok) setStep('csv'); },
            placeholder: 'https://docs.google.com/forms/d/e/.../viewform',
            focus: true, status: urlStatus, theme,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut · t untuk ganti theme'),
          history.length > 0 ? React.createElement(HistoryPanel, { history, theme }) : null,
        )
      : null,

    // CSV
    step === 'csv' && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: useFilePicker ? '📂 Pilih CSV File' : 'CSV Data File', theme },
          useFilePicker
            ? React.createElement(React.Fragment, null,
                React.createElement(FilePicker, { files: csvFiles, selectedIndex: csvFileIndex, onSelect: setCsvFileIndex, focus: true, theme }),
                React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk pilih · p untuk ketik manual · b untuk kembali'),
              )
            : React.createElement(React.Fragment, null,
                React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan path ke file CSV dummy'),
                React.createElement(InputField, {
                  label: 'CSV Path', value: csvPath, onChange: setCsvPath,
                  onSubmit: () => { validateCsv(csvPath).then((v) => { setCsvStatus(v); if (v.ok) { if (v.preview) setCsvPreview(v.preview); setStep('preview'); } }); },
                  placeholder: './data_dummy.csv',
                  focus: true, status: csvStatus, theme,
                }),
                csvFiles.length > 0
                  ? React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, `Enter untuk lanjut · p untuk pilih file (${csvFiles.length} CSV ditemukan) · b untuk kembali`)
                  : React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
              ),
        )
      : null,

    // Preview
    step === 'preview' && csvPreview && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: '📋 CSV Preview', theme },
          React.createElement(CsvPreview, { rows: csvPreview, theme }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut ke Mode →  b untuk kembali'),
        )
      : null,

    // Mode
    step === 'mode' && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: 'Run Mode', theme },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih mode eksekusi'),
          React.createElement(SelectField, { label: 'Mode', options: ['dry-run', 'submit'], value: mode, onChange: setMode, focus: true, theme }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, '↑↓ untuk ganti  Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    // Options
    step === 'options' && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: 'Options', theme },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Atur opsi tambahan (opsional)'),
          React.createElement(InputField, { label: 'Limit baris', value: limit, onChange: setLimit, onSubmit: () => setStep('confirm'), placeholder: 'kosongkan untuk semua', focus: true, theme }),
          React.createElement(
            Box, { paddingLeft: 2, marginTop: 1 },
            React.createElement(Text, { color: noHeader ? theme.warning : theme.dim }, `${noHeader ? '●' : '○'} --no-header `),
            React.createElement(Text, { dimColor: true }, '(tekan n untuk toggle)'),
          ),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    // Confirm
    step === 'confirm' && !showThemePicker
      ? React.createElement(
          BoxPanel, { title: 'Review & Confirm', theme },
          React.createElement(
            Box, { flexDirection: 'column', marginBottom: 1 },
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Form URL  '), React.createElement(Text, { color: theme.info }, formUrl || '-')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'CSV Path  '), React.createElement(Text, { color: theme.info }, csvPath || '-')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Mode      '), React.createElement(Text, { color: mode === 'submit' ? theme.error : theme.success, bold: true }, mode.toUpperCase())),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Limit     '), React.createElement(Text, { color: theme.warning }, limit || 'semua baris')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Rows      '), React.createElement(Text, { color: theme.info }, csvStatus?.ok ? `${csvStatus.lines?.length || '?'} baris` : '-')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Header    '), React.createElement(Text, { color: noHeader ? theme.warning : theme.success }, noHeader ? 'NO HEADER (positional)' : 'WITH HEADER (name match)')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Theme     '), React.createElement(Text, { color: theme.logo[0] }, theme.name)),
          ),
          React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { color: mode === 'submit' ? theme.error : theme.success, bold: true }, mode === 'submit' ? '⚠ Mode SUBMIT akan mengirim data ke Google Form' : '✓ Mode DRY RUN — aman, tidak mengirim data')),
          React.createElement(Text, { dimColor: true, paddingLeft: 1, marginTop: 1 }, 'Enter untuk menjalankan  b untuk kembali'),
        )
      : null,


    // Tools menu
    step === 'tools'
      ? React.createElement(
          BoxPanel, { title: '🛠️ Tools (x to close)', theme },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih tool yang ingin dijalankan:'),
          React.createElement(
            Box, { flexDirection: 'column', paddingLeft: 2 },
            React.createElement(Text, { color: theme.info, bold: true }, '[1] Template   Generate CSV template dari form'),
            React.createElement(Text, { color: theme.info, bold: true }, '[2] Generate   Generate dummy data (10 rows)'),
            React.createElement(Text, { color: theme.info, bold: true }, '[3] Doctor     Cek environment & form'),
          ),
          formUrl.trim()
            ? React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, `Form: ${formUrl.trim().slice(0, 60)}...`)
            : React.createElement(Text, { color: theme.warning, paddingLeft: 2, marginTop: 1 }, '⚠ Isi Form URL dulu untuk pakai tools'),
          toolRunning
            ? React.createElement(Box, { paddingLeft: 2, marginTop: 1 }, React.createElement(Spinner, { text: 'Running...', theme }))
            : null,
          toolResult
            ? React.createElement(
                Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
                React.createElement(Text, { color: toolResult.ok ? theme.success : theme.error, bold: true }, toolResult.ok ? '✓ Result:' : '✗ Error:'),
                ...toolResult.message.split('\n').map((line, i) =>
                  React.createElement(Text, { key: i, color: toolResult.ok ? 'white' : theme.error }, `  ${line}`)
                ),
              )
            : null,
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Press 1/2/3 to run · x to close'),
        )
      : null,

    // Running
    isRunning
      ? React.createElement(
          BoxPanel, { title: '⏳ Running...', theme },
          React.createElement(Box, { paddingLeft: 1, marginTop: 1 }, React.createElement(Spinner, { text: runProgress || 'Memproses...', theme })),
          runStats
            ? React.createElement(
                Box, { flexDirection: 'column', paddingLeft: 2, marginBottom: 1 },
                React.createElement(
                  Box, {},
                  React.createElement(Text, { color: theme.success, bold: true }, `✓ ${runStats.success} `),
                  React.createElement(Text, { color: theme.error, bold: true }, `✗ ${runStats.failed} `),
                  runStats.retried > 0 ? React.createElement(Text, { color: theme.warning, bold: true }, `↻ ${runStats.retried} `) : null,
                  React.createElement(Text, { dimColor: true }, `/ ${runStats.total}`),
                ),
                React.createElement(Text, { color: runStats.currentStatus === 'ok' ? theme.success : runStats.currentStatus === 'failed' ? theme.error : theme.info },
                  `Status: ${runStats.currentStatus || '...'}`),
              )
            : null,
        )
      : null,

    // Done
    step === 'done' && result
      ? React.createElement(
          BoxPanel, { title: result.ok ? '✓ Selesai' : '✗ Error', theme },
          React.createElement(Box, { paddingLeft: 1, marginTop: 1, marginBottom: 1, flexDirection: 'column' },
            React.createElement(Text, { color: result.ok ? theme.success : theme.error }, result.message || (result.ok ? 'Berhasil.' : 'Gagal.')),
            result.reportPath ? React.createElement(Text, { dimColor: true }, `Report: ${result.reportPath}`) : null,
          ),
          React.createElement(Text, { dimColor: true, paddingLeft: 1 }, 'Tekan q untuk keluar · r untuk kembali ke awal'),
        )
      : null,
  );
}

export default GformTui;
