import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { readFile, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERSION = '1.8.0';
const CONFIG_PATH = join(homedir(), '.gformdummy.json');
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ── Config helpers ──

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch { return {}; }
}

async function saveConfig(data) {
  try {
    const existing = await loadConfig();
    await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, ...data }, null, 2), 'utf8');
  } catch {}
}

// ── Validation helpers ──

function validateUrl(url) {
  if (!url.trim()) return { ok: false, msg: 'URL wajib diisi' };
  if (!url.includes('docs.google.com/forms')) return { ok: false, msg: 'Harus URL Google Form (/viewform)' };
  if (!url.includes('/viewform') && !url.includes('/viewform')) return { ok: false, msg: 'URL harus mengandung /viewform' };
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

function Header() {
  const lines = [
    ' ╔═╗ ╔═╗ ╔═╗ ╦═╗ ╔╦╗ ╔╦╗ ╦ ╦ ╔╦╗ ╔╦╗ ╦ ╦',
    ' ║ ╦ ╠╣  ║ ║ ╠╦╝ ║║║  ║║ ║ ║ ║║║ ║║║ ╚╦╝',
    ' ╚═╝ ╚   ╚═╝ ╩╚═ ╩ ╩ ═╩╝ ╚═╝ ╩ ╩ ╩ ╩  ╩',
  ];
  const colors = ['#FF6B6B', '#FFA07A', '#FFD93D'];
  return React.createElement(
    Box, { flexDirection: 'column', marginBottom: 0, paddingLeft: 2 },
    ...lines.map((line, i) =>
      React.createElement(Text, { key: i, color: colors[i], bold: true }, line),
    ),
    React.createElement(
      Box, { marginTop: 1, paddingLeft: 1 },
      React.createElement(Text, { color: '#FFD93D', bold: true }, 'Google Form Dummy Submitter'),
      React.createElement(Text, { dimColor: true }, '  by '),
      React.createElement(Text, { color: '#FF69B4', bold: true }, 'tiyoouw'),
    ),
    React.createElement(
      Box, { paddingLeft: 1 },
      React.createElement(Text, { dimColor: true }, `v${VERSION}`),
      React.createElement(Text, { dimColor: true }, '  ·  '),
      React.createElement(Text, { dimColor: true }, 'Press Ctrl+C to exit'),
    ),
  );
}

function StepBar({ steps, current }) {
  return React.createElement(
    Box, { marginBottom: 1, paddingLeft: 1 },
    ...steps.map((step, i) => {
      const isActive = step.key === current;
      const isDone = steps.findIndex((s) => s.key === current) > i;
      const color = isActive ? 'cyan' : isDone ? 'green' : 'gray';
      const prefix = isDone ? ' ✓ ' : isActive ? ' ▸ ' : '   ';
      const suffix = i < steps.length - 1 ? ' ──' : '';
      return React.createElement(Text, { key: step.key, color, bold: isActive }, `${prefix}${step.label}${suffix}`);
    }),
  );
}

function InputField({ label, value, onChange, onSubmit, placeholder, focus, status }) {
  if (!focus) {
    return React.createElement(
      Box, { paddingLeft: 2 },
      React.createElement(Text, { bold: true, color: 'white' }, `${label}: `),
      React.createElement(Text, { color: value ? 'green' : 'gray' }, value || placeholder),
    );
  }
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, `▸ ${label}`),
    React.createElement(
      Box, { paddingLeft: 2, marginTop: 0 },
      React.createElement(Text, { color: 'white' }, '> '),
      React.createElement(TextInput, { value, onChange, onSubmit, placeholder }),
    ),
    status
      ? React.createElement(Text, { color: status.ok ? 'green' : 'red', paddingLeft: 2 }, status.msg)
      : null,
  );
}

function SelectField({ label, options, value, onChange, focus }) {
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
    React.createElement(Text, { bold: true, color: focus ? 'cyan' : 'white' }, `${focus ? '▸' : ' '} ${label}`),
    ...options.map((opt) => {
      const isActive = opt === value;
      return React.createElement(
        Box, { key: opt, paddingLeft: 3 },
        React.createElement(Text, { color: isActive ? 'cyan' : 'gray', bold: isActive }, `${isActive ? '●' : '○'} ${opt}`),
      );
    }),
  );
}

function BoxPanel({ children, title, width = 80 }) {
  return React.createElement(
    Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingLeft: 1, paddingRight: 1, width },
    title ? React.createElement(Box, { marginBottom: 0 }, React.createElement(Text, { bold: true, color: 'cyan' }, ` ${title} `)) : null,
    children,
  );
}

function Spinner({ text }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % SPIN_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, []);
  return React.createElement(Text, { color: 'cyan' }, `${SPIN_FRAMES[frame]} ${text}`);
}

function CsvPreview({ rows }) {
  if (!rows || rows.length === 0) return null;
  const headers = rows[0]?.split(',') || [];
  const dataRows = rows.slice(1);
  return React.createElement(
    Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
    React.createElement(Text, { bold: true, color: 'yellow' }, '📋 Preview CSV:'),
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

function SavedConfigPrompt({ configs, onSelect, onSkip }) {
  useInput(
    (input, key) => {
      if (input === 'n' || input === 'N') onSkip();
      const num = parseInt(input, 10);
      if (num >= 1 && num <= configs.length) onSelect(configs[num - 1]);
    },
    { isActive: true },
  );
  return React.createElement(
    BoxPanel, { title: '📂 Saved Configs' },
    React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih config tersimpan atau tekan N untuk mulai baru:'),
    ...configs.map((cfg, i) =>
      React.createElement(
        Box, { key: i, paddingLeft: 2 },
        React.createElement(Text, { color: 'cyan', bold: true }, `[${i + 1}] `),
        React.createElement(Text, { color: 'white' }, cfg.name || cfg.formUrl?.slice(0, 60) || `Config ${i + 1}`),
      ),
    ),
    React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Tekan nomor atau N untuk baru'),
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
  const [configName, setConfigName] = useState('');

  const steps = [
    { key: 'url', label: 'Form URL' },
    { key: 'csv', label: 'CSV Path' },
    { key: 'preview', label: 'Preview' },
    { key: 'mode', label: 'Mode' },
    { key: 'options', label: 'Options' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // Load saved configs on mount
  useEffect(() => {
    loadConfig().then((cfg) => {
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
    if (step === 'url' && formUrl.trim()) {
      setUrlStatus(validateUrl(formUrl));
    } else {
      setUrlStatus(null);
    }
  }, [formUrl, step]);

  // Validate CSV on change
  useEffect(() => {
    if (step === 'csv' && csvPath.trim()) {
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
  }, [csvPath, step]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') { exit(); return; }

      if (step === 'init') return; // handled by SavedConfigPrompt

      if (step === 'url') {
        if (key.return) {
          const v = validateUrl(formUrl);
          setUrlStatus(v);
          if (v.ok) setStep('csv');
        }
      }

      if (step === 'csv') {
        if (key.return) {
          validateCsv(csvPath).then((v) => {
            setCsvStatus(v);
            if (v.ok) {
              if (v.preview) setCsvPreview(v.preview);
              setStep('preview');
            }
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

        // Save to recent configs
        await saveConfig({
          recent: [
            { name: configName.trim() || formUrl.trim().slice(0, 60), ...config, savedAt: new Date().toISOString() },
            ...(await loadConfig()).recent || [],
          ].slice(0, 10),
        });

        setRunProgress('Menjalankan...');
        const runResult = await onComplete(config);
        setResult(runResult || { ok: true, message: 'Selesai.' });
      } else {
        setResult({ ok: true, message: 'Konfigurasi siap. Jalankan dari CLI.' });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }
    setIsRunning(false);
    setRunProgress(null);
    setStep('done');
  }, [formUrl, csvPath, mode, limit, configName, onComplete]);

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
    React.createElement(Header, null),
    step !== 'init' ? React.createElement(StepBar, { steps, current: step }) : null,

    // ── Init: saved configs ──
    step === 'init' && savedConfigs.length > 0
      ? React.createElement(SavedConfigPrompt, {
          configs: savedConfigs,
          onSelect: handleSelectConfig,
          onSkip: () => setStep('url'),
        })
      : null,

    // ── URL step ──
    step === 'url'
      ? React.createElement(
          BoxPanel, { title: 'Google Form URL' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan URL public Google Form (/viewform)'),
          React.createElement(InputField, {
            label: 'Form URL', value: formUrl, onChange: setFormUrl,
            onSubmit: () => { const v = validateUrl(formUrl); setUrlStatus(v); if (v.ok) setStep('csv'); },
            placeholder: 'https://docs.google.com/forms/d/e/.../viewform',
            focus: true, status: urlStatus,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →'),
        )
      : null,

    // ── CSV step ──
    step === 'csv'
      ? React.createElement(
          BoxPanel, { title: 'CSV Data File' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan path ke file CSV dummy'),
          React.createElement(InputField, {
            label: 'CSV Path', value: csvPath, onChange: setCsvPath,
            onSubmit: () => { validateCsv(csvPath).then((v) => { setCsvStatus(v); if (v.ok) { if (v.preview) setCsvPreview(v.preview); setStep('preview'); } }); },
            placeholder: './data_dummy.csv',
            focus: true, status: csvStatus,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    // ── Preview step ──
    step === 'preview' && csvPreview
      ? React.createElement(
          BoxPanel, { title: '📋 CSV Preview' },
          React.createElement(CsvPreview, { rows: csvPreview }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut ke Mode →  b untuk kembali'),
        )
      : null,

    // ── Mode step ──
    step === 'mode'
      ? React.createElement(
          BoxPanel, { title: 'Run Mode' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih mode eksekusi'),
          React.createElement(SelectField, { label: 'Mode', options: ['dry-run', 'submit'], value: mode, onChange: setMode, focus: true }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, '↑↓ untuk ganti  Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    // ── Options step ──
    step === 'options'
      ? React.createElement(
          BoxPanel, { title: 'Options' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Atur opsi tambahan (opsional)'),
          React.createElement(InputField, { label: 'Limit baris', value: limit, onChange: setLimit, onSubmit: () => setStep('confirm'), placeholder: 'kosongkan untuk semua', focus: true }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    // ── Confirm step ──
    step === 'confirm'
      ? React.createElement(
          BoxPanel, { title: 'Review & Confirm' },
          React.createElement(
            Box, { flexDirection: 'column', marginBottom: 1 },
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Form URL  '), React.createElement(Text, { color: 'cyan' }, formUrl || '-')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'CSV Path  '), React.createElement(Text, { color: 'cyan' }, csvPath || '-')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Mode      '), React.createElement(Text, { color: mode === 'submit' ? 'red' : 'green', bold: true }, mode.toUpperCase())),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Limit     '), React.createElement(Text, { color: 'yellow' }, limit || 'semua baris')),
            React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { bold: true }, 'Rows      '), React.createElement(Text, { color: 'cyan' }, csvStatus?.ok ? `${csvStatus.lines?.length || '?'} baris` : '-')),
          ),
          React.createElement(Box, { paddingLeft: 1 }, React.createElement(Text, { color: mode === 'submit' ? 'red' : 'green', bold: true }, mode === 'submit' ? '⚠ Mode SUBMIT akan mengirim data ke Google Form' : '✓ Mode DRY RUN — aman, tidak mengirim data')),
          React.createElement(Text, { dimColor: true, paddingLeft: 1, marginTop: 1 }, 'Enter untuk menjalankan  b untuk kembali'),
        )
      : null,

    // ── Running ──
    isRunning
      ? React.createElement(
          BoxPanel, { title: '⏳ Running...' },
          React.createElement(Box, { paddingLeft: 1, marginTop: 1, marginBottom: 1 }, React.createElement(Spinner, { text: runProgress || 'Memproses...' })),
        )
      : null,

    // ── Done ──
    step === 'done' && result
      ? React.createElement(
          BoxPanel, { title: result.ok ? '✓ Selesai' : '✗ Error' },
          React.createElement(Box, { paddingLeft: 1, marginTop: 1, marginBottom: 1, flexDirection: 'column' },
            React.createElement(Text, { color: result.ok ? 'green' : 'red' }, result.message || (result.ok ? 'Berhasil.' : 'Gagal.')),
          ),
          React.createElement(Text, { dimColor: true, paddingLeft: 1 }, 'Tekan q atau Enter untuk keluar'),
        )
      : null,
  );
}

export default GformTui;
