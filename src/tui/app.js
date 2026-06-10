import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

function StepIndicator({ steps, current }) {
  return React.createElement(
    Box,
    { marginBottom: 1 },
    React.createElement(Text, { bold: true }, steps.map((step) => (step === current ? `[${step}]` : step)).join('  ')),
  );
}

function PromptLine({ label, value, active }) {
  return React.createElement(
    Box,
    null,
    React.createElement(Text, { bold: true, color: active ? 'cyan' : undefined }, `${label}: `),
    React.createElement(Text, null, value || (active ? '...' : '-')),
  );
}

export function GformTui() {
  const { exit } = useApp();
  const steps = ['welcome', 'url', 'csv', 'mode', 'summary'];
  const [step, setStep] = useState('welcome');
  const [focusIndex, setFocusIndex] = useState(0);
  const [formUrl, setFormUrl] = useState('');
  const [csvPath, setCsvPath] = useState('');
  const [mode, setMode] = useState('dry-run');
  const [error, setError] = useState(null);
  const [quit, setQuit] = useState(false);

  useInput((input, key) => {
    if (input === 'q') {
      setQuit(true);
      return;
    }

    if (step === 'welcome') {
      if (key.return) setStep('url');
      return;
    }

    if (step === 'mode') {
      if (key.upArrow || key.leftArrow) setMode('dry-run');
      if (key.downArrow || key.rightArrow) setMode('submit');
      if (key.return) setStep('summary');
      return;
    }

    if (step === 'summary') {
      return;
    }
  });

  if (quit) {
    return React.createElement(Box, { padding: 1 }, React.createElement(Text, { color: 'yellow' }, 'Keluar dari wizard.'));
  }

  if (step === 'welcome') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true }, 'gformdummy interactive wizard'),
      React.createElement(Text, null, 'Tekan Enter untuk mulai. Tekan q untuk keluar.'),
      React.createElement(Text, { color: 'green' }, 'Mode default: dry-run'),
    );
  }

  if (step === 'url') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StepIndicator, { steps, current: step }),
      React.createElement(Text, { bold: true }, 'Masukkan Google Form public URL (/viewform):'),
      React.createElement(Text, { color: 'cyan' }, formUrl || 'contoh: https://docs.google.com/forms/d/e/.../viewform'),
      error ? React.createElement(Text, { color: 'red' }, error) : null,
      React.createElement(Text, null, 'Tekan Enter untuk lanjut. (full text input coming soon)'),
    );
  }

  if (step === 'csv') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StepIndicator, { steps, current: step }),
      React.createElement(Text, { bold: true }, 'Masukkan path CSV dummy:'),
      React.createElement(Text, { color: 'cyan' }, csvPath || 'contoh: ./data_dummy.csv'),
      React.createElement(Text, null, 'Tekan Enter untuk lanjut.'),
    );
  }

  if (step === 'mode') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StepIndicator, { steps, current: step }),
      React.createElement(Text, { bold: true }, 'Pilih mode:'),
      React.createElement(Text, { color: mode === 'dry-run' ? 'cyan' : undefined }, `${mode === 'dry-run' ? '▶ ' : '  '}Dry run`),
      React.createElement(Text, { color: mode === 'submit' ? 'cyan' : undefined }, `${mode === 'submit' ? '▶ ' : '  '}Submit`),
      React.createElement(Text, null, 'Arrow keys lalu Enter.'),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(StepIndicator, { steps, current: 'summary' }),
    React.createElement(Text, { bold: true }, 'Wizard summary'),
    React.createElement(PromptLine, { label: 'Form URL', value: formUrl, active: false }),
    React.createElement(PromptLine, { label: 'CSV', value: csvPath, active: false }),
    React.createElement(PromptLine, { label: 'Mode', value: mode, active: false }),
    React.createElement(Text, { color: 'green' }, 'Tekan q untuk keluar. Full run integration coming next.'),
  );
}

export default GformTui;
