import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { readFile, writeFile, access, readdir, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { getTheme, THEME_NAMES } from '../themes.js';

const VERSION = '1.9.0';
const CONFIG_PATH = join(homedir(), '.gformdummy.json');
const REPORTS_DIR = join(homedir(), '.gformdummy', 'reports');
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
    return { ok: true, msg: `✓ Ditemukan ${lines.length - 1} baris data`, lines, preview: lines.slice(0, 6) };
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
  if (!rows || rows.length === 0) return null;
  const headers = rows[0]?.split(',') || [];
  const dataRows = rows.slice(1);
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
    React.createElement(Text, { bold: true, color: theme.warning }, '📋 Preview CSV:'),
    React.createElement(Text, { dimColor: true }, headers.map(h => h.trim().slice(0, 15).padEnd(16)).join('')),
    React.createElement(Text, { dimColor: true }, headers.map(() => '─'.repeat(16)).join('')),
    ...dataRows.map((row, i) => {
      const cols = row.split(',').map(c => c.trim().slice(0, 15).padEnd(16));
      return React.createElement(Text, { key: i, color: 'white' }, cols.join(''));
    }),
    dataRows.length < rows.length - 1
      ? React.createElement(Text, { dimColor: true, italic: true }, `  ... dan ${rows.length - 1 - dataRows.length} baris lagi`)
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
  const [showThemePicker, setShowThemePicker] = useState(false);

  const theme = getTheme(themeName);

  const steps = [
    { key: 'url', label: 'Form URL' },
    { key: 'csv', label: 'CSV Path' },
    { key: 'preview', label: 'Preview' },
    { key: 'mode', label: 'Mode' },
    { key: 'options', label: 'Options' },
    { key: 'confirm', label: 'Confirm' },
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
      }

      if (step === 'confirm' && !isRunning && !result) {
        if (key.return) handleRun();
        if (input === 'b') setStep('options');
      }

      if (step === 'done') {
        if (input === 'q' || key.return) {
          if (onComplete) onComplete(result);
          exit();
        }
      }
    },
    { isActive: isRawModeSupported },
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setRunProgress('Mengambil metadata form & memvalidasi CSV...');
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
          autoPageHistory: true,
          pageHistoryOverride: '',
          confirm: true,
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
        const runResult = await onComplete(config);

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
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Theme     '), React.createElement(Text, { color: theme.logo[0] }, theme.name)),
          ),
          React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { color: mode === 'submit' ? theme.error : theme.success, bold: true }, mode === 'submit' ? '⚠ Mode SUBMIT akan mengirim data ke Google Form' : '✓ Mode DRY RUN — aman, tidak mengirim data')),
          React.createElement(Text, { dimColor: true, paddingLeft: 1, marginTop: 1 }, 'Enter untuk menjalankan  b untuk kembali'),
        )
      : null,

    // Running
    isRunning
      ? React.createElement(
          BoxPanel, { title: '⏳ Running...', theme },
          React.createElement(Box, { paddingLeft: 1, marginTop: 1, marginBottom: 1 }, React.createElement(Spinner, { text: runProgress || 'Memproses...', theme })),
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
          React.createElement(Text, { dimColor: true, paddingLeft: 1 }, 'Tekan q atau Enter untuk keluar'),
        )
      : null,
  );
}

export default GformTui;
