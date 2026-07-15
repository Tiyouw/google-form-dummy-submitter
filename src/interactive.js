import inquirer from 'inquirer';
import chalk from 'chalk';
import { readFile } from 'node:fs/promises';

import {
  buildPayload,
  fetchForm,
  parseCsv,
  selectCsvHeaders,
  validateRows,
} from './core.js';
import { loadProfiles, saveProfile, getProfile } from './profiles.js';

function profileToDefaults(profile) {
  return {
    formUrl: profile.formUrl || '',
    csvPath: profile.csvPath || '',
    mode: profile.mode || 'dry-run',
    limit: profile.limit != null ? String(profile.limit) : '',
    encoding: profile.encoding || 'utf8',
    autoPageHistory: profile.autoPageHistory !== false,
    pageHistoryOverride: profile.pageHistoryOverride || '',
  };
}

export function resolveRunConfig(answers) {
  const formUrl = String(answers.formUrl ?? '').trim();
  const csvPath = String(answers.csvPath ?? '').trim();
  const mode = String(answers.mode ?? 'dry-run').trim();
  const encoding = String(answers.encoding ?? 'utf8').trim() || 'utf8';
  const pageHistoryOverride = String(answers.pageHistoryOverride ?? '').trim();

  if (!formUrl) throw new Error('formUrl wajib diisi');
  if (!csvPath) throw new Error('csvPath wajib diisi');

  const limitRaw = answers.limit === '' || answers.limit == null ? '' : String(answers.limit).trim();
  const limit = limitRaw === '' ? null : Number.parseInt(limitRaw, 10);
  if (limit !== null && (!Number.isFinite(limit) || limit < 1 || !Number.isInteger(limit))) {
    throw new Error('limit harus integer >= 1');
  }

  return {
    formUrl,
    csvPath,
    mode,
    submit: mode === 'submit',
    limit,
    encoding,
    autoPageHistory: answers.autoPageHistory !== false,
    pageHistoryOverride,
    confirm: answers.confirm === true,
  };
}

export async function buildPromptRunConfig({ answers, formMeta, csv, previewPayload }) {
  const { fields, hidden } = formMeta ?? {};
  const { headers, rows } = csv ?? {};
  return {
    ...resolveRunConfig(answers),
    previewFieldCount: Array.isArray(fields) ? fields.length : null,
    previewRowCount: Array.isArray(rows) ? rows.length : null,
    previewHeaders: Array.isArray(headers) ? headers : null,
    previewPayload: previewPayload ?? null,
    pageHistory: hidden?.pageHistory ?? null,
    inferredPageHistory: hidden?.__inferred_page_history ?? null,
    actionUrl: hidden?.__action_url ?? null,
  };
}

export function runInteractive({ defaultFormUrl = '', defaultCsvPath = '', defaultMode = 'dry-run', defaultLimit = '' } = {}) {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'formUrl',
      message: 'Google Form public URL (/viewform):',
      default: defaultFormUrl,
      validate: (value) => (String(value).trim() ? true : 'URL wajib diisi'),
    },
    {
      type: 'input',
      name: 'csvPath',
      message: 'Path file CSV dummy:',
      default: defaultCsvPath,
      validate: (value) => (String(value).trim() ? true : 'Path CSV wajib diisi'),
    },
    {
      type: 'list',
      name: 'mode',
      message: 'Pilih mode:',
      choices: [
        { name: 'Dry run (aman, tidak submit)', value: 'dry-run' },
        { name: 'Submit', value: 'submit' },
      ],
      default: defaultMode,
    },
    {
      type: 'input',
      name: 'limit',
      message: 'Limit baris (kosongkan untuk semua):',
      default: defaultLimit,
    },
    {
      type: 'input',
      name: 'encoding',
      message: 'Encoding CSV:',
      default: 'utf8',
    },
    {
      type: 'confirm',
      name: 'autoPageHistory',
      message: 'Gunakan inferensi otomatis pageHistory?',
      default: true,
    },
    {
      type: 'input',
      name: 'pageHistoryOverride',
      message: 'Override pageHistory manual (opsional, contoh 0,1,2,3,4,5,6):',
      default: '',
    },
  ]);
}

export async function runWizardMain(options = {}) {
  const profiles = await loadProfiles();
  let defaults = { ...options };

  if (profiles.length > 0) {
    const choices = [
      { name: 'Mulai manual (tanpa profile)', value: '' },
      ...profiles.map((p) => ({ name: `${p.name}  →  ${p.csvPath} (${p.mode})`, value: p.name })),
    ];
    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: 'Pilih profile tersimpan:',
        choices,
      },
    ]);
    if (profileName) {
      const profile = getProfile(profileName, profiles);
      if (profile) defaults = { ...defaults, ...profileToDefaults(profile) };
    }
  }

  const answers = await runInteractive(defaults);

  console.log(chalk.bold('\nMengambil metadata form...'));
  const csvText = await readFile(answers.csvPath, answers.encoding);
  const { headers: csvHeaders, rows } = parseCsv(csvText);
  const { fields, hidden } = await fetchForm(answers.formUrl, { timeout: 30_000, autoPageHistory: answers.autoPageHistory });

  const pageHistory = answers.pageHistoryOverride || hidden.__inferred_page_history || hidden.pageHistory;
  const selectedHeaders = selectCsvHeaders(csvHeaders, fields);
  const { selectedHeaders: validatedHeaders, normalizationCount } = validateRows(csvHeaders, rows, fields, hidden, {
    pageHistory,
  });

  const previewRow = rows[0];
  const { payload: previewPayload, notes } = buildPayload(previewRow, validatedHeaders, fields, hidden, { pageHistory });
  const namePreview = previewRow[validatedHeaders[0]]?.trim?.() ?? '';

  console.log(chalk.green(`Field form: ${fields.length}`));
  console.log(chalk.green(`Kolom CSV: ${validatedHeaders.length}`));
  console.log(chalk.green(`Baris CSV: ${rows.length}`));
  if (normalizationCount) console.log(chalk.yellow(`Normalisasi opsi: ${normalizationCount}`));
  if (notes.length) console.log(chalk.yellow(`Preview normalisasi baris 1: ${JSON.stringify(notes.slice(0, 3))}`));
  console.log(chalk.bold(`Preview row #1: ${JSON.stringify(namePreview)}`));

  const config = await buildPromptRunConfig({
    answers,
    formMeta: { fields, hidden },
    csv: { headers: validatedHeaders, rows },
    previewPayload,
  });

  const confirmAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Lanjutkan ${config.mode === 'submit' ? 'submit' : 'dry run'} ${config.limit ?? rows.length} baris?`,
      default: config.mode !== 'submit',
    },
  ]);

  config.confirm = confirmAnswer.confirm;

  if (!config.confirm) {
    console.log(chalk.yellow('Dibatalkan oleh user.'));
    return config;
  }

  const { saveProfileName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'saveProfileName',
      message: 'Nama profile untuk disimpan (kosongkan untuk skip):',
      default: '',
    },
  ]);

  if (saveProfileName.trim()) {
    await saveProfile({
      name: saveProfileName.trim(),
      formUrl: config.formUrl,
      csvPath: config.csvPath,
      mode: config.mode,
      limit: config.limit,
      encoding: config.encoding,
      autoPageHistory: config.autoPageHistory,
      pageHistoryOverride: config.pageHistoryOverride || '',
      noHeader: false,
      theme: 'sunset',
      retry: 3,
      stopOnError: false,
      mapping: null,
      namePrefix: '',
      previewRows: 3,
    });
    console.log(chalk.green(`Profile tersimpan: ${saveProfileName.trim()}`));
  }

  return config;
}
