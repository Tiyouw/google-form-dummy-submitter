#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import {
  buildPayload,
  fetchForm,
  parseCsv,
  submitOne,
  validateRows,
} from '../src/core.js';
import React from 'react';
import { render } from 'ink';
import { GformTui } from '../src/tui/app.js';
import { checkForUpdate, formatUpdateMessage } from '../src/update-check.js';

const VERSION = '1.7.0';

const HELP = `Google Form Dummy Submitter

Usage:
  gformdummy [options]              Launch interactive TUI (default)
  gformdummy --form-url URL --csv PATH [options]   CLI mode

Safety:
  Default mode is dry-run. Add --submit to actually send responses.
  Use only for forms you own or have permission to test.

Required:
  --form-url <url>       Google Form public /viewform URL
  --csv <path>           CSV dummy data path

Options:
  --dry-run              Validate and preview only (default when --submit is absent)
  --submit               Actually submit responses
  --limit <n>            Process at most n rows
  --start <n>            Start from data row n, 1-based, excluding header (default: 1)
  --delay <seconds>      Base delay between submits (default: 0.8)
  --jitter <seconds>     Random extra delay between submits (default: 0.4)
  --encoding <encoding>  CSV file encoding (default: utf8)
  --timeout <seconds>    HTTP timeout (default: 30)
  --page-history <value> Override Google Forms pageHistory, e.g. 0,1,2,3,4,5,6
  --no-auto-page-history Disable automatic pageHistory inference
  --name-prefix <text>   Prefix first field, useful for one-row test submits
  --preview-rows <n>     Number of rows to preview in dry-run (default: 3)
  -h, --help             Show help
  -v, --version          Show version

Examples:
  gformdummy
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --dry-run --limit 3
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --submit --limit 1 --delay 0 --jitter 0
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --submit --start 2
`;

function parseArgs(argv) {
  const args = {
    submit: false,
    dryRun: false,
    interactive: false,
    limit: null,
    start: 1,
    delay: 0.8,
    jitter: 0.4,
    encoding: 'utf8',
    timeout: 30,
    pageHistory: null,
    autoPageHistory: true,
    namePrefix: '',
    previewRows: 3,
    argvLength: argv.length,
  };

  const needsValue = new Set([
    '--form-url',
    '--csv',
    '--limit',
    '--start',
    '--delay',
    '--jitter',
    '--encoding',
    '--timeout',
    '--page-history',
    '--name-prefix',
    '--preview-rows',
  ]);

  function setValue(key, value) {
    switch (key) {
      case '--form-url': args.formUrl = value; break;
      case '--csv': args.csv = value; break;
      case '--limit': args.limit = Number.parseInt(value, 10); break;
      case '--start': args.start = Number.parseInt(value, 10); break;
      case '--delay': args.delay = Number.parseFloat(value); break;
      case '--jitter': args.jitter = Number.parseFloat(value); break;
      case '--encoding': args.encoding = value; break;
      case '--timeout': args.timeout = Number.parseFloat(value); break;
      case '--page-history': args.pageHistory = value; break;
      case '--name-prefix': args.namePrefix = value; break;
      case '--preview-rows': args.previewRows = Number.parseInt(value, 10); break;
      default: throw new Error(`Unknown option: ${key}`);
    }
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--version' || token === '-v') args.version = true;
    else if (token === '--submit') args.submit = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--interactive') args.interactive = true;
    else if (token === '--no-auto-page-history') args.autoPageHistory = false;
    else if (token.includes('=') && token.startsWith('--')) {
      const [key, ...rest] = token.split('=');
      if (!needsValue.has(key)) throw new Error(`Unknown option or unexpected value: ${key}`);
      setValue(key, rest.join('='));
    } else if (needsValue.has(token)) {
      const value = argv[i + 1];
      if (value == null || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
      setValue(token, value);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.submit) args.dryRun = true;
  return args;
}

function assertPositiveNumber(name, value, { integer = false } = {}) {
  const valid = Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value));
  if (!valid) throw new Error(`${name} harus ${integer ? 'integer ' : ''}>= 0`);
}

function validateArgs(args) {
  if (!args.formUrl) throw new Error('--form-url wajib diisi');
  if (!args.csv) throw new Error('--csv wajib diisi');
  if (args.start < 1 || !Number.isInteger(args.start)) throw new Error('--start harus integer >= 1');
  if (args.limit !== null && (args.limit < 1 || !Number.isInteger(args.limit))) throw new Error('--limit harus integer >= 1');
  assertPositiveNumber('--delay', args.delay);
  assertPositiveNumber('--jitter', args.jitter);
  assertPositiveNumber('--timeout', args.timeout);
  assertPositiveNumber('--preview-rows', args.previewRows, { integer: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCore(config) {
  const csvText = await readFile(config.csvPath, config.encoding);
  const { headers: csvHeaders, rows } = parseCsv(csvText);
  const { fields, hidden } = await fetchForm(config.formUrl, {
    timeout: 30_000,
    autoPageHistory: config.autoPageHistory !== false,
  });

  const pageHistory = config.pageHistoryOverride || hidden.__inferred_page_history || hidden.pageHistory;
  const { selectedHeaders, normalizationCount } = validateRows(csvHeaders, rows, fields, hidden, {
    pageHistory,
  });

  const startIndex = (config.start || 1) - 1;
  let selectedRows = rows.slice(startIndex);
  if (config.limit != null) selectedRows = selectedRows.slice(0, config.limit);

  const messages = [];
  messages.push(`OK: ${rows.length} baris CSV valid.`);
  messages.push(`OK: ${fields.length} field Form cocok dengan ${selectedHeaders.length} kolom CSV.`);
  messages.push(`OK: pageHistory yang dipakai: ${JSON.stringify(pageHistory ?? '<kosong>')}.`);
  if (hidden.__page_history_note) messages.push(`Info: ${hidden.__page_history_note}.`);
  if (normalizationCount) messages.push(`Catatan: ${normalizationCount} nilai opsi akan dinormalisasi.`);
  messages.push(`Mode: ${config.submit ? 'SUBMIT' : 'DRY RUN'}`);
  messages.push(`Action URL: ${hidden.__action_url}`);
  messages.push(`Baris diproses: ${startIndex + 1} sampai ${startIndex + selectedRows.length} (${selectedRows.length} baris)`);

  let failures = 0;
  for (let offset = 0; offset < selectedRows.length; offset += 1) {
    const rowNumber = startIndex + 1 + offset;
    const row = selectedRows[offset];
    const { payload, notes } = buildPayload(row, selectedHeaders, fields, hidden, {
      pageHistory,
    });
    const name = row[selectedHeaders[0]]?.trim?.() ?? '';

    if (!config.submit) {
      if (offset < 3) {
        const firstKeys = fields.slice(0, 5).map((field) => field.entryName);
        const lastKeys = fields.slice(Math.max(0, fields.length - 2)).map((field) => field.entryName);
        const preview = Object.fromEntries([...new Set([...firstKeys, ...lastKeys])].map((key) => [key, payload[key]]));
        messages.push(`DRY row #${rowNumber}: ${JSON.stringify(name)} preview=${JSON.stringify(preview)}`);
        if (notes.length) messages.push(`  normalisasi: ${JSON.stringify(notes.slice(0, 3))}`);
      }
      continue;
    }

    const result = await submitOne(hidden.__action_url, payload, config.formUrl, { timeout: 30_000 });
    if (result.ok) {
      messages.push(`OK submit row #${rowNumber}: ${JSON.stringify(name)} status=${result.status}`);
    } else {
      failures += 1;
      messages.push(`FAIL submit row #${rowNumber}: ${JSON.stringify(name)} status=${result.status}`);
      break;
    }

    await sleep(800 + Math.random() * 400);
  }

  if (config.submit && failures) {
    messages.push(`Selesai dengan kegagalan: ${failures}`);
    return { ok: false, message: messages.join('\n') };
  }

  messages.push('Selesai.');
  return { ok: true, message: messages.join('\n') };
}

async function main() {
  const updatePromise = checkForUpdate({ currentVersion: VERSION });
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(VERSION);
    return 0;
  }

  const shouldLaunchTui = args.argvLength === 0 || (args.interactive && !args.formUrl && !args.csv);
  if (shouldLaunchTui) {
    if (!process.stdin.isTTY) {
      console.error('Non-interactive environment detected. Open the tool in a real terminal to use TUI mode, or pass values directly:');
      console.error('  gformdummy --form-url <URL> --csv <path> [--submit]');
      return 1;
    }

    updatePromise.then((update) => {
      const msg = formatUpdateMessage(update);
      if (msg) console.error(msg);
    }).catch(() => {});

    const { waitUntilExit } = render(
      React.createElement(GformTui, {
        onComplete: async (config) => {
          if (!config || !config.confirm) return null;
          return runCore(config);
        },
      }),
    );
    await waitUntilExit();
    return 0;
  }

  validateArgs(args);

  const config = {
    formUrl: args.formUrl,
    csvPath: args.csv,
    submit: args.submit,
    limit: args.limit,
    encoding: args.encoding,
    autoPageHistory: args.autoPageHistory,
    pageHistoryOverride: args.pageHistory,
    start: args.start,
  };

  const result = await runCore(config);
  console.log(result.message);

  const update = await updatePromise.catch(() => null);
  const msg = formatUpdateMessage(update);
  if (msg) console.error(msg);

  return result.ok ? 0 : 2;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
