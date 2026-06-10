#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import {
  buildPayload,
  fetchForm,
  parseCsv,
  submitOne,
  validateRows,
} from '../src/core.js';
import { runWizardMain } from '../src/interactive.js';

const HELP = `Google Form Dummy Submitter

Usage:
  gformdummy --form-url <GOOGLE_FORM_VIEWFORM_URL> --csv <data.csv> [options]

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
  --interactive          Prompt missing values when possible (for real terminals)
  -h, --help             Show help
  -v, --version          Show version

Examples:
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --dry-run --limit 3
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --submit --limit 1 --delay 0 --jitter 0
  gformdummy --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --csv data.csv --submit --start 2
  gformdummy --interactive
`;

function parseArgs(argv) {
  const args = {
    submit: false,
    interactive: false,
    dryRun: false,
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
    else if (token === '--interactive') args.interactive = true;
    else if (token === '--submit') args.submit = true;
    else if (token === '--dry-run') args.dryRun = true;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log('1.1.0');
    return 0;
  }

  if (args.interactive) {
    if (!process.stdin.isTTY) {
      console.error('Non-interactive environment detected. Run interactively in a real terminal, or pass the missing values directly:');
      console.error('  gformdummy --form-url <URL> --csv <path> [--submit]');
      return 1;
    }

    const wizard = await runWizardMain({
      defaultFormUrl: args.formUrl ?? '',
      defaultCsvPath: args.csv ?? '',
      defaultMode: args.submit ? 'submit' : 'dry-run',
      defaultLimit: args.limit != null ? String(args.limit) : '',
    });

    if (!wizard.confirm) return 0;

    args.formUrl = args.formUrl || wizard.formUrl;
    args.csv = args.csv || wizard.csvPath;
    args.encoding = args.encoding || wizard.encoding;
    args.autoPageHistory = wizard.autoPageHistory;
    args.pageHistory = args.pageHistory || wizard.pageHistoryOverride || null;
    args.limit = args.limit ?? wizard.limit;
    args.submit = wizard.submit;
    if (!args.submit) args.dryRun = true;
  }

  validateArgs(args);

  const csvText = await readFile(args.csv, args.encoding);
  const { headers: csvHeaders, rows } = parseCsv(csvText);
  const { fields, hidden } = await fetchForm(args.formUrl, {
    timeout: args.timeout * 1000,
    autoPageHistory: args.autoPageHistory,
  });

  const pageHistory = args.pageHistory || hidden.__inferred_page_history || hidden.pageHistory;
  const { selectedHeaders, normalizationCount } = validateRows(csvHeaders, rows, fields, hidden, {
    pageHistory,
    namePrefix: args.namePrefix,
  });

  console.log(`OK: ${rows.length} baris CSV valid.`);
  console.log(`OK: ${fields.length} field Form cocok dengan ${selectedHeaders.length} kolom CSV.`);
  console.log(`OK: pageHistory yang dipakai: ${JSON.stringify(pageHistory ?? '<kosong>')}.`);
  if (hidden.__page_history_note) console.log(`Info: ${hidden.__page_history_note}.`);
  if (normalizationCount) console.log(`Catatan: ${normalizationCount} nilai opsi akan dinormalisasi agar cocok dengan opsi Form.`);

  const startIndex = args.start - 1;
  let selectedRows = rows.slice(startIndex);
  if (args.limit !== null) selectedRows = selectedRows.slice(0, args.limit);
  if (!selectedRows.length) {
    console.log('Tidak ada baris yang diproses setelah --start/--limit.');
    return 0;
  }

  console.log(`Mode: ${args.submit ? 'SUBMIT' : 'DRY RUN'}`);
  console.log(`Action URL: ${hidden.__action_url}`);
  console.log(`Baris diproses: ${args.start} sampai ${args.start + selectedRows.length - 1} (${selectedRows.length} baris)`);

  let failures = 0;
  for (let offset = 0; offset < selectedRows.length; offset += 1) {
    const rowNumber = args.start + offset;
    const row = selectedRows[offset];
    const { payload, notes } = buildPayload(row, selectedHeaders, fields, hidden, {
      pageHistory,
      namePrefix: args.namePrefix,
    });
    const name = row[selectedHeaders[0]]?.trim?.() ?? '';
    const displayName = args.namePrefix ? `${args.namePrefix}${name}` : name;

    if (!args.submit) {
      if (offset < args.previewRows) {
        const firstKeys = fields.slice(0, 5).map((field) => field.entryName);
        const lastKeys = fields.slice(Math.max(0, fields.length - 2)).map((field) => field.entryName);
        const preview = Object.fromEntries([...new Set([...firstKeys, ...lastKeys])].map((key) => [key, payload[key]]));
        console.log(`DRY row #${rowNumber}: ${JSON.stringify(displayName)} preview=${JSON.stringify(preview)}`);
        if (notes.length) console.log(`  normalisasi: ${JSON.stringify(notes.slice(0, 3))}`);
      }
      continue;
    }

    const result = await submitOne(hidden.__action_url, payload, args.formUrl, { timeout: args.timeout * 1000 });
    if (result.ok) {
      console.log(`OK submit row #${rowNumber}: ${JSON.stringify(displayName)} status=${result.status}`);
    } else {
      failures += 1;
      console.error(`FAIL submit row #${rowNumber}: ${JSON.stringify(displayName)} status=${result.status} snippet=${JSON.stringify(result.snippet)}`);
      break;
    }

    await sleep((args.delay + Math.random() * args.jitter) * 1000);
  }

  if (args.submit && failures) {
    console.error(`Selesai dengan kegagalan: ${failures}`);
    return 2;
  }

  console.log('Selesai.');
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
