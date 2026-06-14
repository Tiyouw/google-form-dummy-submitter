#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  buildPayload,
  fetchForm,
  parseCsv,
  selectCsvHeaders,
  submitOne,
  validateRows,
} from '../src/core.js';
import React from 'react';
import { render } from 'ink';
import { GformTui } from '../src/tui/app.js';
import { checkForUpdate, formatUpdateMessage } from '../src/update-check.js';
import { THEMES, THEME_NAMES } from '../src/themes.js';

const VERSION = '1.19.0';

const HELP = `Google Form Dummy Submitter

Usage:
  gformdummy [options]              Launch interactive TUI (default)
  gformdummy --form-url URL --csv PATH [options]   CLI mode
  gformdummy template --form-url URL [--out file.csv]  Generate CSV template
  gformdummy doctor [--form-url URL] [--csv PATH]      Check environment
  gformdummy generate --form-url URL [--rows N] [--out data.csv] [--locale id]

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
  --theme <name>         UI theme: sunset, ocean, forest, purple, matrix, monokai
  --no-header            CSV has no header row, use form field order
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
    noHeader: false,
    theme: 'sunset',
    retry: 3,
    stopOnError: false,
    mapping: null,
    map: false,
    json: false,
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
    '--theme',
    '--retry',
    '--rows',
    '--out',
    '--locale',
    '--mapping',
    '--json',
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
      case '--retry': args.retry = Number.parseInt(value, 10); break;
      case '--rows': args.rows = Number.parseInt(value, 10); break;
      case '--out': args.out = value; break;
      case '--locale': args.locale = value; break;
      case '--mapping': args.mapping = value; break;
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
    else if (token === '--no-header') args.noHeader = true;
    else if (token === '--stop-on-error') args.stopOnError = true;
    else if (token === '--map') args.map = true;
    else if (token === '--json') args.json = true;
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
  if (args.retry < 0 || !Number.isInteger(args.retry)) throw new Error('--retry harus integer >= 0');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCore(config, onProgress = null) {
  // Load mapping file if provided
  let mapping = null;
  if (config.mapping) {
    try {
      const mappingText = await readFile(config.mapping, 'utf8');
      mapping = JSON.parse(mappingText);
    } catch (e) {
      throw new Error(`Cannot read mapping file: ${config.mapping} — ${e.message}`);
    }
  }

  const csvText = await readFile(config.csvPath, config.encoding);
  const { headers: csvHeaders, rows } = parseCsv(csvText);
  const { fields, hidden } = await fetchForm(config.formUrl, {
    timeout: 30_000,
    autoPageHistory: config.autoPageHistory !== false,
  });

  const pageHistory = config.pageHistoryOverride || hidden.__inferred_page_history || hidden.pageHistory;
  const { selectedHeaders, normalizationCount } = validateRows(csvHeaders, rows, fields, hidden, {
    pageHistory, noHeader: config.noHeader, mapping,
  });

  const startIndex = (config.start || 1) - 1;
  let selectedRows = rows.slice(startIndex);
  if (config.limit != null) selectedRows = selectedRows.slice(0, config.limit);

  const totalRows = selectedRows.length;
  const maxRetries = config.retry ?? 3;
  const stopOnError = config.stopOnError ?? false;

  const messages = [];
  messages.push(`OK: ${rows.length} baris CSV valid.`);
  messages.push(`OK: ${fields.length} field Form cocok dengan ${selectedHeaders.length} kolom CSV.`);
  messages.push(`OK: pageHistory yang dipakai: ${JSON.stringify(pageHistory ?? '<kosong>')}.`);
  if (hidden.__page_history_note) messages.push(`Info: ${hidden.__page_history_note}.`);
  if (normalizationCount) messages.push(`Catatan: ${normalizationCount} nilai opsi akan dinormalisasi.`);
  messages.push(`Mode: ${config.submit ? 'SUBMIT' : 'DRY RUN'}`);
  messages.push(`Action URL: ${hidden.__action_url}`);
  messages.push(`Baris diproses: ${startIndex + 1} sampai ${startIndex + totalRows} (${totalRows} baris)`);
  if (config.submit && maxRetries > 0) messages.push(`Retry: ${maxRetries}x per row`);

  // Enhanced dry-run report
  if (!config.submit) {
    messages.push('');
    messages.push('═══ DRY RUN REPORT ═══');

    // Field matching summary
    messages.push(`\nFields (${fields.length}):`);
    fields.forEach((f, i) => {
      const csvHeader = selectedHeaders[i] || '(none)';
      const matchType = csvHeader === f.title ? '✓ exact' : '✓ mapped';
      const required = f.required ? ' [REQUIRED]' : '';
      const options = f.options.length ? ` (${f.options.length} options)` : '';
      messages.push(`  ${matchType} #${i + 1}: CSV="${csvHeader}" → Form="${f.title}"${options}${required}`);
    });

    // Required field check
    const requiredFields = fields.filter(f => f.required);
    if (requiredFields.length > 0) {
      messages.push(`\nRequired fields (${requiredFields.length}):`);
      requiredFields.forEach(f => {
        const hasData = selectedRows.some(row => {
          const val = String(row[selectedHeaders[fields.indexOf(f)]] ?? '').trim();
          return val.length > 0;
        });
        messages.push(`  ${hasData ? '✓' : '⚠'} ${f.title}`);
      });
    }

    // Potential option issues (sample first 5 rows)
    messages.push(`\nOption validation (first ${Math.min(5, totalRows)} rows):`);
    let issueCount = 0;
    for (let i = 0; i < Math.min(5, totalRows); i += 1) {
      const row = selectedRows[i];
      fields.forEach((f, fi) => {
        if (!f.options.length) return;
        const val = String(row[selectedHeaders[fi]] ?? '').trim();
        if (!val) return;
        const parts = val.includes(',') ? val.split(',').map(s => s.trim()) : [val];
        for (const part of parts) {
          const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
          const match = f.options.find(o => o.toLowerCase().replace(/\s+/g, ' ').trim() === normalized);
          if (!match) {
            messages.push(`  ⚠ Row ${startIndex + 1 + i}: "${f.title}" value "${part}" not in options [${f.options.slice(0, 3).join(', ')}${f.options.length > 3 ? '...' : ''}]`);
            issueCount += 1;
          }
        }
      });
    }
    if (issueCount === 0) messages.push('  ✓ All sampled values match form options');

    messages.push('\n═══ END REPORT ═══');
  }

  const progress = {
    current: 0, total: totalRows,
    success: 0, failed: 0, retried: 0,
    currentName: '', currentStatus: '',
    failedRows: [],
    done: false,
  };

  function emitProgress() {
    if (onProgress) onProgress({ ...progress });
  }

  for (let offset = 0; offset < totalRows; offset += 1) {
    const rowNumber = startIndex + 1 + offset;
    const row = selectedRows[offset];
    const { payload, notes } = buildPayload(row, selectedHeaders, fields, hidden, {
      pageHistory,
    });
    const name = row[selectedHeaders[0]]?.trim?.() ?? `Row ${rowNumber}`;

    progress.current = offset + 1;
    progress.currentName = name;
    progress.currentStatus = 'pending';
    emitProgress();

    if (!config.submit) {
      if (offset < 3) {
        const previewPairs = payload.filter(([k]) => k.startsWith('entry.')).slice(0, 7);
        const preview = Object.fromEntries(previewPairs);
        messages.push(`DRY row #${rowNumber}: ${JSON.stringify(name)} preview=${JSON.stringify(preview)}`);
        if (notes.length) messages.push(`  normalisasi: ${JSON.stringify(notes.slice(0, 3))}`);
      }
      progress.currentStatus = 'dry-run';
      progress.success += 1;
      emitProgress();
      continue;
    }

    // Submit with retry
    let lastResult = null;
    let attempt = 0;
    for (attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        progress.retried += 1;
        progress.currentStatus = `retry ${attempt}/${maxRetries}`;
        emitProgress();
        await sleep(1000 * attempt); // Exponential backoff
      }

      lastResult = await submitOne(hidden.__action_url, payload, config.formUrl, { timeout: 30_000 });
      if (lastResult.ok) break;
    }

    if (lastResult.ok) {
      progress.success += 1;
      progress.currentStatus = 'ok';
      messages.push(`OK submit row #${rowNumber}: ${JSON.stringify(name)} status=${lastResult.status}${attempt > 0 ? ` (retry ${attempt})` : ''}`);
    } else {
      progress.failed += 1;
      progress.currentStatus = 'failed';
      progress.failedRows.push({
        rowNumber,
        name,
        status: lastResult.status,
        error: lastResult.snippet?.slice(0, 100) || 'Unknown error',
        csvRow: row,
      });
      messages.push(`FAIL submit row #${rowNumber}: ${JSON.stringify(name)} status=${lastResult.status} (after ${maxRetries} retries)`);
      if (stopOnError) {
        messages.push('Stopping on error (--stop-on-error)');
        break;
      }
    }
    emitProgress();

    const delay = (config.delay ?? 0.8) * 1000;
    const jitter = (config.jitter ?? 0.4) * 1000;
    await sleep(delay + Math.random() * jitter);
  }

  progress.done = true;
  emitProgress();

  // Export failed rows to CSV if any
  if (progress.failedRows.length > 0) {
    try {
      const reportDir = join(homedir(), '.gformdummy', 'reports');
      await mkdir(reportDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const failedCsvPath = join(reportDir, `failed-${ts}.csv`);
      const failedHeaders = selectedHeaders.join(',');
      const failedLines = progress.failedRows.map(r => {
        return selectedHeaders.map(h => {
          const val = String(r.csvRow[h] ?? '').replaceAll('"', '""');
          return val.includes(',') ? `"${val}"` : val;
        }).join(',');
      });
      await writeFile(failedCsvPath, failedHeaders + '\n' + failedLines.join('\n'), 'utf8');
      messages.push(`Failed rows exported: ${failedCsvPath}`);
      progress.failedCsvPath = failedCsvPath;
    } catch (e) {
      messages.push(`Warning: Could not export failed rows: ${e.message}`);
    }
  }

  const hasFailures = progress.failed > 0;
  if (hasFailures) {
    messages.push(`Selesai: ${progress.success} berhasil, ${progress.failed} gagal, ${progress.retried} retry.`);
    return { ok: false, message: messages.join('\n'), progress };
  }

  messages.push(`Selesai: ${progress.success} berhasil.`);
  return { ok: true, message: messages.join('\n'), progress };
}


async function runTemplate(args) {
  if (!args.formUrl) {
    console.error('ERROR: --form-url wajib diisi untuk template');
    console.error('Usage: gformdummy template --form-url URL [--out template.csv]');
    return 1;
  }

  console.log(`Fetching form: ${args.formUrl}`);
  const { fields } = await fetchForm(args.formUrl, { timeout: 30_000 });

  console.log(`Found ${fields.length} fields:\n`);

  // Generate CSV headers
  const headers = ['Timestamp', ...fields.map(f => f.title)];

  // Generate example row
  const exampleRow = fields.map(f => {
    if (f.options.length > 0) return f.options[0];
    switch (f.itemType) {
      case 0: return 'Contoh Teks';
      case 1: return 'Contoh paragraf panjang...';
      case 2: return f.options[0] || 'Pilihan';
      case 5: return '3';
      case 7: return f.options.slice(0, 2).join(', ');
      case 9: return '6/14/2026';
      case 10: return '12:00:00 PM';
      case 18: return '4';
      default: return 'Contoh';
    }
  });

  const csvContent = headers.join(',') + '\n' + ['6/14/2026 12:00:00', ...exampleRow].join(',') + '\n';

  // Show preview
  console.log('Generated template:');
  console.log('─'.repeat(60));
  console.log(headers.join(', '));
  console.log('─'.repeat(60));
  console.log(['6/14/2026 12:00:00', ...exampleRow].join(', '));
  console.log('─'.repeat(60));
  console.log();

  // Field details
  fields.forEach((f, i) => {
    const type = f.options.length ? `select (${f.options.length} options)` : `text (type ${f.itemType})`;
    console.log(`  #${i + 1}: ${f.title} [${type}]`);
    if (f.options.length > 0 && f.options.length <= 5) {
      console.log(`       Options: ${f.options.join(', ')}`);
    }
  });

  // Write to file
  const outPath = args.out || 'template.csv';
  await writeFile(outPath, csvContent, 'utf8');
  console.log(`\nTemplate saved to: ${outPath}`);
  return 0;
}

async function ensureDir(dir) {
  try { await mkdir(dir, { recursive: true }); } catch {}
}

async function runDoctor(args) {
  const checks = [];
  const warnings = [];
  const errors = [];

  function addCheck(name, status, message) {
    const entry = { name, status, message };
    checks.push(entry);
    if (status === 'warn') warnings.push(entry);
    if (status === 'error') errors.push(entry);
  }

  // 1. Node version
  addCheck('Node.js version', 'pass', process.version);

  // 2. Package version
  addCheck('gformdummy version', 'pass', VERSION);

  // 3. Internet connection
  try {
    const resp = await fetch('https://www.google.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    addCheck('Internet connection', 'pass', 'Available');
  } catch (e) {
    addCheck('Internet connection', 'error', e.message);
  }

  // 4. Config directory
  try {
    const configDir = join(homedir(), '.gformdummy');
    await mkdir(configDir, { recursive: true });
    addCheck('Config directory', 'pass', configDir);
  } catch (e) {
    addCheck('Config directory', 'error', e.message);
  }

  // 5. Reports directory
  try {
    await ensureDir(join(homedir(), '.gformdummy', 'reports'));
    addCheck('Reports directory', 'pass', join(homedir(), '.gformdummy', 'reports'));
  } catch (e) {
    addCheck('Reports directory', 'error', e.message);
  }

  // 6. Form checks
  let formFields = null;
  if (args.formUrl) {
    try {
      const { fields, hidden } = await fetchForm(args.formUrl, { timeout: 15_000 });
      formFields = fields;
      addCheck('Form accessible', 'pass', `${fields.length} fields found`);

      // Check for unsupported field types
      const unsupported = fields.filter(f => ![0, 1, 2, 3, 4, 5, 7, 9, 10, 18].includes(f.itemType));
      if (unsupported.length > 0) {
        addCheck('Unsupported fields', 'warn', unsupported.map(f => `${f.title} (type ${f.itemType})`).join(', '));
      }

      // Count required fields
      const required = fields.filter(f => f.required);
      addCheck('Required fields', 'pass', `${required.length} required: ${required.map(f => f.title).join(', ')}`);

    } catch (e) {
      addCheck('Form accessible', 'error', e.message);
    }
  } else {
    addCheck('Form accessible', 'skip', 'No --form-url provided');
  }

  // 7. CSV checks
  if (args.csv) {
    try {
      const csvText = await readFile(args.csv, args.encoding || 'utf8');
      const { headers, rows } = parseCsv(csvText);
      addCheck('CSV file', 'pass', `${headers.length} columns, ${rows.length} rows`);

      // Check header matching if form is available
      if (formFields) {
        try {
          const selectedHeaders = selectCsvHeaders(headers, formFields, { noHeader: args.noHeader });
          addCheck('Header matching', 'pass', `${selectedHeaders.length}/${formFields.length} fields matched`);

          // Check unmapped columns
          if (headers.length > formFields.length) {
            addCheck('Extra CSV columns', 'warn', `${headers.length - formFields.length} extra columns`);
          }

          // Check required fields
          const required = formFields.filter(f => f.required);
          for (const f of required) {
            const idx = formFields.indexOf(f);
            const hasData = rows.some(row => String(row[selectedHeaders[idx]] ?? '').trim().length > 0);
            if (!hasData) {
              addCheck(`Required field: ${f.title}`, 'error', 'No data in any row');
            }
          }

          // Sample option validation (first 3 rows)
          let optionIssues = 0;
          for (let i = 0; i < Math.min(3, rows.length); i += 1) {
            const row = rows[i];
            formFields.forEach((f, fi) => {
              if (!f.options.length) return;
              const val = String(row[selectedHeaders[fi]] ?? '').trim();
              if (!val) return;
              const parts = val.includes(',') ? val.split(',').map(s => s.trim()) : [val];
              for (const part of parts) {
                const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
                const match = f.options.find(o => o.toLowerCase().replace(/\s+/g, ' ').trim() === normalized);
                if (!match) optionIssues += 1;
              }
            });
          }
          if (optionIssues > 0) {
            addCheck('Option values', 'warn', `${optionIssues} potential invalid options in first 3 rows`);
          } else {
            addCheck('Option values', 'pass', 'All sampled values valid');
          }

        } catch (e) {
          addCheck('Header matching', 'error', e.message);
        }
      }
    } catch (e) {
      addCheck('CSV file', 'error', e.message);
    }
  } else {
    addCheck('CSV file', 'skip', 'No --csv provided');
  }

  // Output
  if (args.json) {
    console.log(JSON.stringify({
      ok: errors.length === 0,
      checks,
      warnings: warnings.length,
      errors: errors.length,
    }, null, 2));
  } else {
    console.log('gformdummy doctor\n');
    const maxName = Math.max(...checks.map(c => c.name.length));
    for (const check of checks) {
      const icon = check.status === 'pass' ? '\x1b[32m✓\x1b[0m' : check.status === 'error' ? '\x1b[31m✗\x1b[0m' : check.status === 'warn' ? '\x1b[33m!\x1b[0m' : '\x1b[33m○\x1b[0m';
      console.log(`  ${icon} ${check.name.padEnd(maxName + 2)} ${check.message}`);
    }
    console.log();
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
      errors.forEach(e => console.log(`  ✗ ${e.name}: ${e.message}`));
    }
    if (warnings.length > 0) {
      console.log(`Warnings: ${warnings.length}`);
      warnings.forEach(w => console.log(`  ! ${w.name}: ${w.message}`));
    }
    if (errors.length === 0 && warnings.length === 0) {
      console.log('No issues found.');
    }
  }

  return errors.length > 0 ? 1 : 0;
}


// Indonesian dummy data
const ID_NAMES = ['Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gilang', 'Hani', 'Indra', 'Joko', 'Kartika', 'Lestari', 'Maya', 'Nanda', 'Omar', 'Putri', 'Rizki', 'Sari', 'Tono', 'Ulya', 'Vina', 'Wahyu', 'Xena', 'Yoga', 'Zahra'];
const ID_CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Malang', 'Medan', 'Makassar', 'Denpasar', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Solo', 'Palembang'];
const ID_DIVISIONS = ['BPH', 'PSDM', 'HUMAS', 'KOMINFO', 'ACARA', 'DANUS', 'KESEKRETARIATAN'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'student.university.ac.id'];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${month}/${day}/2026`;
}

function randomTime() {
  const hour = randomInt(8, 22);
  const minute = randomInt(0, 59);
  return `${hour}:${String(minute).padStart(2, '0')}:00 PM`;
}

function randomPhone() {
  return '08' + randomInt(1000000000, 9999999999);
}

function randomEmail(name) {
  const clean = name.toLowerCase().replace(/\s+/g, '.');
  return clean + randomInt(1, 999) + '@' + randomFrom(DOMAINS);
}

function generateValue(field, locale, rowIndex) {
  const title = field.title.toLowerCase();

  // Date
  if (field.itemType === 9) return randomDate();

  // Time
  if (field.itemType === 10) return randomTime();

  // Rating
  if (field.itemType === 18) return String(randomInt(1, field.options.length || 5));

  // Linear scale
  if (field.itemType === 5) return String(randomInt(1, field.options.length || 5));

  // Checkbox grid / checkbox: pick random options
  if ((field.itemType === 7 || field.itemType === 4) && field.options.length >= 2) {
    const count = randomInt(1, Math.min(2, field.options.length));
    const shuffled = [...field.options].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).join(', ');
  }

  // Dropdown/Radio with options: pick random option
  if (field.options.length > 0) return randomFrom(field.options);

  // Smart name detection (only for text fields without options)
  if (title.includes('nama') || title === 'name') {
    return locale === 'id' ? randomFrom(ID_NAMES) : 'User ' + (rowIndex + 1);
  }

  // Email
  if (title.includes('email') || title.includes('e-mail')) {
    const name = locale === 'id' ? randomFrom(ID_NAMES) : 'User' + (rowIndex + 1);
    return randomEmail(name);
  }

  // Phone
  if (title.includes('phone') || title.includes('hp') || title.includes('wa') || title.includes('telepon') || title.includes('nomor')) {
    return randomPhone();
  }

  // City/Location
  if (title.includes('kota') || title.includes('city') || title.includes('alamat') || title.includes('address')) {
    return locale === 'id' ? randomFrom(ID_CITIES) : 'City ' + (rowIndex + 1);
  }

  // Division/Department
  if (title.includes('divisi') || title.includes('department') || title.includes('jurusan')) {
    return randomFrom(ID_DIVISIONS);
  }

  // Link/URL
  if (title.includes('link') || title.includes('url') || title.includes('video')) {
    return 'https://drive.google.com/file/d/' + randomFrom(ID_NAMES).toLowerCase() + '/view';
  }

  // Paragraph
  if (field.itemType === 1) {
    const paragraphs = [
      'Ini adalah contoh paragraf untuk testing purposes.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Data dummy untuk keperluan QA dan testing form.',
      'Test response untuk validasi pipeline data.',
    ];
    return randomFrom(paragraphs);
  }

  // Default text
  return 'Contoh ' + (rowIndex + 1);
}

async function runGenerate(args) {
  if (!args.formUrl) {
    console.error('ERROR: --form-url wajib diisi untuk generate');
    console.error('Usage: gformdummy generate --form-url URL [--rows 50] [--out dummy.csv] [--locale id]');
    return 1;
  }

  const rows = args.rows || 10;
  const locale = args.locale || 'id';
  const outPath = args.out || 'dummy.csv';

  console.log(`Fetching form: ${args.formUrl}`);
  const { fields } = await fetchForm(args.formUrl, { timeout: 30_000 });
  console.log(`Found ${fields.length} fields`);

  // Generate CSV
  const headers = ['Timestamp', ...fields.map(f => f.title)];
  const csvRows = [];

  for (let i = 0; i < rows; i += 1) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const values = [timestamp];

    for (const field of fields) {
      values.push(generateValue(field, locale, i));
    }

    // Handle CSV quoting for values with commas
    const quoted = values.map(v => {
      const str = String(v ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? '"' + str.replaceAll('"', '""') + '"'
        : str;
    });
    csvRows.push(quoted.join(','));
  }

  const csvContent = headers.join(',') + '\n' + csvRows.join('\n') + '\n';

  // Show preview
  console.log(`\nGenerated ${rows} dummy rows (${locale} locale):\n`);
  console.log(headers.join(', '));
  console.log('─'.repeat(60));
  for (let i = 0; i < Math.min(3, csvRows.length); i += 1) {
    const row = csvRows[i];
    const display = row.length > 80 ? row.slice(0, 77) + '...' : row;
    console.log(display);
  }
  if (csvRows.length > 3) console.log(`... ${csvRows.length - 3} more rows`);

  await writeFile(outPath, csvContent, 'utf8');
  console.log(`\nDummy data saved to: ${outPath}`);
  console.log(`\nTo submit: gformdummy --form-url "${args.formUrl}" --csv ${outPath} --submit`);
  return 0;
}

async function main() {
  const updatePromise = checkForUpdate({ currentVersion: VERSION });
  const rawArgs = process.argv.slice(2);
  const subcommand = ['template', 'doctor', 'generate'].includes(rawArgs[0]) ? rawArgs[0] : null;
  const args = parseArgs(subcommand ? rawArgs.slice(1) : rawArgs);

  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(VERSION);
    return 0;
  }

  // Handle subcommands
  if (subcommand === 'template') {
    return runTemplate(args);
  }
  if (subcommand === 'doctor') {
    return runDoctor(args);
  }
  if (subcommand === 'generate') {
    return runGenerate(args);
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
        onComplete: async (config, onProgress) => {
          if (!config || !config.confirm) return null;
          return runCore(config, onProgress);
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
    noHeader: args.noHeader,
    autoPageHistory: args.autoPageHistory,
    pageHistoryOverride: args.pageHistory,
    start: args.start,
    retry: args.retry,
    stopOnError: args.stopOnError,
    mapping: args.mapping,
    map: args.map,
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
