import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';

const VERSION = '1.4.0';

function Header() {
  const art = [
    '  ╔═══════════════════════════════════════════════════════════╗',
    '  ║                                                           ║',
    '  ║   ██████   ██████   ██████   ███    ███  ██████  ██   ██  ║',
    '  ║   ██       ██  ██   ██  ██  ████  ████  ██  ██  ██   ██  ║',
    '  ║   ██  ███  ██████   ██████  ██ ████ ██  ██████  ██   ██  ║',
    '  ║   ██   ██  ██  ██   ██  ██  ██  ██  ██  ██  ██  ██   ██  ║',
    '  ║   ██████   ██  ██   ██  ██  ██      ██  ██████   █████   ║',
    '  ║                                                           ║',
    '  ║           Google Form Dummy Submitter                     ║',
    '  ║                                                           ║',
    '  ╚═══════════════════════════════════════════════════════════╝',
  ];

  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    ...art.map((line, i) => {
      const isBorder = i === 0 || i === art.length - 1 || i === 1 || i === 8 || i === 10;
      const isTitle = i === 9;
      return React.createElement(
        Text,
        { key: i, color: isBorder ? 'blue' : isTitle ? 'white' : 'cyan', bold: isTitle },
        line,
      );
    }),
    React.createElement(
      Box,
      { marginTop: 0, paddingLeft: 2 },
      React.createElement(Text, { dimColor: true }, `v${VERSION}`),
      React.createElement(Text, { dimColor: true }, '  ·  '),
      React.createElement(Text, { dimColor: true }, 'Press Ctrl+C to exit'),
    ),
  );
}

function StepBar({ steps, current }) {
  return React.createElement(
    Box,
    { marginBottom: 1, paddingLeft: 1 },
    ...steps.map((step, i) => {
      const isActive = step.key === current;
      const isDone = steps.findIndex((s) => s.key === current) > i;
      const color = isActive ? 'cyan' : isDone ? 'green' : 'gray';
      const prefix = isDone ? ' ✓ ' : isActive ? ' ▸ ' : '   ';
      const suffix = i < steps.length - 1 ? ' ──' : '';
      return React.createElement(
        Text,
        { key: step.key, color, bold: isActive },
        `${prefix}${step.label}${suffix}`,
      );
    }),
  );
}

function InputField({ label, value, onChange, onSubmit, placeholder, focus }) {
  if (!focus) {
    return React.createElement(
      Box,
      { paddingLeft: 2 },
      React.createElement(Text, { bold: true, color: 'white' }, `${label}: `),
      React.createElement(Text, { color: value ? 'green' : 'gray' }, value || placeholder),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingLeft: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, `▸ ${label}`),
    React.createElement(
      Box,
      { paddingLeft: 2, marginTop: 0 },
      React.createElement(Text, { color: 'white' }, '> '),
      React.createElement(TextInput, {
        value,
        onChange,
        onSubmit,
        placeholder,
      }),
    ),
  );
}

function SelectField({ label, options, value, onChange, focus }) {
  useInput(
    (input, key) => {
      if (!focus) return;
      const idx = options.indexOf(value);
      if (key.upArrow || key.leftArrow) {
        onChange(options[Math.max(0, idx - 1)]);
      } else if (key.downArrow || key.rightArrow) {
        onChange(options[Math.min(options.length - 1, idx + 1)]);
      }
    },
    { isActive: focus },
  );

  return React.createElement(
    Box,
    { flexDirection: 'column', paddingLeft: 1 },
    React.createElement(Text, { bold: true, color: focus ? 'cyan' : 'white' }, `${focus ? '▸' : ' '} ${label}`),
    ...options.map((opt) => {
      const isActive = opt === value;
      return React.createElement(
        Box,
        { key: opt, paddingLeft: 3 },
        React.createElement(
          Text,
          { color: isActive ? 'cyan' : 'gray', bold: isActive },
          `${isActive ? '●' : '○'} ${opt}`,
        ),
      );
    }),
  );
}

function BoxPanel({ children, title, width = 80 }) {
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingLeft: 1,
      paddingRight: 1,
      paddingTop: 0,
      paddingBottom: 0,
      width,
    },
    title
      ? React.createElement(
          Box,
          { marginBottom: 0 },
          React.createElement(Text, { bold: true, color: 'cyan' }, ` ${title} `),
        )
      : null,
    children,
  );
}

export function GformTui({ onComplete }) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const [step, setStep] = useState('url');
  const [formUrl, setFormUrl] = useState('');
  const [csvPath, setCsvPath] = useState('');
  const [mode, setMode] = useState('dry-run');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  const steps = [
    { key: 'url', label: 'Form URL' },
    { key: 'csv', label: 'CSV Path' },
    { key: 'mode', label: 'Mode' },
    { key: 'options', label: 'Options' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      if (step === 'confirm' && !isRunning && !result) {
        if (key.return) {
          handleRun();
        }
        if (input === 'b') {
          setStep('options');
        }
      }

      if (step === 'mode') {
        if (key.return) {
          setStep('options');
        }
      }

      if (step === 'options') {
        if (key.return) {
          setStep('confirm');
        }
        if (input === 'b') {
          setStep('mode');
        }
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
    setError(null);
    try {
      if (onComplete) {
        const config = {
          formUrl: formUrl.trim(),
          csvPath: csvPath.trim(),
          mode,
          submit: mode === 'submit',
          limit: limit.trim() ? Number.parseInt(limit.trim(), 10) : null,
          encoding: 'utf8',
          autoPageHistory: true,
          pageHistoryOverride: '',
          confirm: true,
        };
        const runResult = await onComplete(config);
        setResult(runResult || { ok: true, message: 'Selesai.' });
      } else {
        setResult({ ok: true, message: 'Konfigurasi siap. Jalankan dari CLI dengan argumen lengkap.' });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }
    setIsRunning(false);
    setStep('done');
  }, [formUrl, csvPath, mode, limit, onComplete]);

  if (!isRawModeSupported) {
    return React.createElement(
      Box,
      { padding: 1 },
      React.createElement(Text, { color: 'red' }, 'Terminal tidak mendukung raw mode. Gunakan CLI flags.'),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 0 },
    React.createElement(Header, null),
    React.createElement(StepBar, { steps, current: step }),

    step === 'url'
      ? React.createElement(
          BoxPanel,
          { title: 'Google Form URL' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan URL public Google Form (/viewform)'),
          React.createElement(InputField, {
            label: 'Form URL',
            value: formUrl,
            onChange: setFormUrl,
            onSubmit: () => {
              if (!formUrl.trim()) {
                setError('URL wajib diisi');
                return;
              }
              setError(null);
              setStep('csv');
            },
            placeholder: 'https://docs.google.com/forms/d/e/.../viewform',
            focus: true,
          }),
          error ? React.createElement(Text, { color: 'red', paddingLeft: 2 }, `✗ ${error}`) : null,
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →'),
        )
      : null,

    step === 'csv'
      ? React.createElement(
          BoxPanel,
          { title: 'CSV Data File' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Masukkan path ke file CSV dummy'),
          React.createElement(InputField, {
            label: 'CSV Path',
            value: csvPath,
            onChange: setCsvPath,
            onSubmit: () => {
              if (!csvPath.trim()) {
                setError('Path CSV wajib diisi');
                return;
              }
              setError(null);
              setStep('mode');
            },
            placeholder: './data_dummy.csv',
            focus: true,
          }),
          error ? React.createElement(Text, { color: 'red', paddingLeft: 2 }, `✗ ${error}`) : null,
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    step === 'mode'
      ? React.createElement(
          BoxPanel,
          { title: 'Run Mode' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Pilih mode eksekusi'),
          React.createElement(SelectField, {
            label: 'Mode',
            options: ['dry-run', 'submit'],
            value: mode,
            onChange: setMode,
            focus: true,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, '↑↓ untuk ganti  Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    step === 'options'
      ? React.createElement(
          BoxPanel,
          { title: 'Options' },
          React.createElement(Text, { dimColor: true, marginBottom: 1 }, 'Atur opsi tambahan (opsional)'),
          React.createElement(InputField, {
            label: 'Limit baris',
            value: limit,
            onChange: setLimit,
            onSubmit: () => setStep('confirm'),
            placeholder: 'kosongkan untuk semua',
            focus: true,
          }),
          React.createElement(Text, { dimColor: true, paddingLeft: 2, marginTop: 1 }, 'Enter untuk lanjut →  b untuk kembali'),
        )
      : null,

    step === 'confirm'
      ? React.createElement(
          BoxPanel,
          { title: 'Review & Confirm' },
          React.createElement(
            Box,
            { flexDirection: 'column', marginBottom: 1 },
            React.createElement(
              Box,
              { paddingLeft: 1 },
              React.createElement(Text, { bold: true, color: 'white', dimColor: false }, 'Form URL  '),
              React.createElement(Text, { color: 'cyan' }, formUrl || '-'),
            ),
            React.createElement(
              Box,
              { paddingLeft: 1 },
              React.createElement(Text, { bold: true }, 'CSV Path  '),
              React.createElement(Text, { color: 'cyan' }, csvPath || '-'),
            ),
            React.createElement(
              Box,
              { paddingLeft: 1 },
              React.createElement(Text, { bold: true }, 'Mode      '),
              React.createElement(Text, { color: mode === 'submit' ? 'red' : 'green', bold: true }, mode.toUpperCase()),
            ),
            React.createElement(
              Box,
              { paddingLeft: 1 },
              React.createElement(Text, { bold: true }, 'Limit     '),
              React.createElement(Text, { color: 'yellow' }, limit || 'semua baris'),
            ),
          ),
          React.createElement(
            Box,
            { paddingLeft: 1, marginTop: 0 },
            React.createElement(Text, { color: mode === 'submit' ? 'red' : 'green', bold: true }, mode === 'submit' ? '⚠ Mode SUBMIT akan mengirim data ke Google Form' : '✓ Mode DRY RUN — aman, tidak mengirim data'),
          ),
          React.createElement(Text, { dimColor: true, paddingLeft: 1, marginTop: 1 }, 'Enter untuk menjalankan  b untuk kembali'),
        )
      : null,

    isRunning
      ? React.createElement(
          BoxPanel,
          { title: 'Running...' },
          React.createElement(
            Box,
            { paddingLeft: 1, marginTop: 1, marginBottom: 1 },
            React.createElement(Text, { color: 'cyan' }, '⠋ Mengambil metadata form & memvalidasi CSV...'),
          ),
        )
      : null,

    step === 'done' && result
      ? React.createElement(
          BoxPanel,
          { title: result.ok ? '✓ Selesai' : '✗ Error' },
          React.createElement(
            Box,
            { paddingLeft: 1, marginTop: 1, marginBottom: 1 },
            React.createElement(Text, { color: result.ok ? 'green' : 'red' }, result.message || (result.ok ? 'Berhasil.' : 'Gagal.')),
          ),
          React.createElement(Text, { dimColor: true, paddingLeft: 1 }, 'Tekan q atau Enter untuk keluar'),
        )
      : null,
  );
}

export default GformTui;
