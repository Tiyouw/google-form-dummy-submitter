export const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const TIMESTAMP_HEADERS = new Set([
  'timestamp',
  'stempel waktu',
  'cap waktu',
  'time stamp',
  'horodateur',
  'marca temporal',
]);

export function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function parseAttributes(tag) {
  const attrs = {};
  const attrRe = /([^\s=<>]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s<>]+))/g;
  let match;
  while ((match = attrRe.exec(tag))) {
    const name = match[1].toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? '';
    attrs[name] = decodeHtmlEntities(rawValue);
  }
  return attrs;
}

function extractHiddenInputs(pageHtml) {
  const hidden = {};
  const inputRe = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRe.exec(pageHtml))) {
    const attrs = parseAttributes(match[0]);
    if ((attrs.type ?? '').toLowerCase() !== 'hidden' || !attrs.name) continue;
    hidden[attrs.name] = attrs.value ?? '';
  }
  return hidden;
}

function getFormAction(pageHtml, formUrl) {
  const actionMatch = pageHtml.match(/<form\b[^>]*\saction=("([^"]*)"|'([^']*)')/i);
  if (actionMatch) {
    return decodeHtmlEntities(actionMatch[2] ?? actionMatch[3] ?? '');
  }
  if (formUrl.includes('/viewform')) return formUrl.replace('/viewform', '/formResponse');
  return new URL('/formResponse', formUrl).toString();
}

function makeField({ title, entryId, required, options, itemType }) {
  return {
    title,
    entryId,
    required,
    options,
    itemType,
    get entryName() {
      return `entry.${entryId}`;
    },
    get sentinelName() {
      return `entry.${entryId}_sentinel`;
    },
  };
}

export function parseFormHtml(pageHtml, formUrl, options = {}) {
  const { autoPageHistory = true } = options;
  const match = pageHtml.match(/var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/s);
  if (!match) {
    throw new Error('Tidak menemukan FB_PUBLIC_LOAD_DATA_. Pastikan URL adalah Google Form publik /viewform dan tidak butuh login.');
  }

  const publicData = JSON.parse(match[1]);
  const items = publicData?.[1]?.[1];
  if (!Array.isArray(items)) throw new Error('Struktur metadata Google Form tidak dikenali.');

  const fields = [];
  let sectionLikeCount = 0;

  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const itemType = item[3];
    if (itemType === 8) sectionLikeCount += 1;

    const questions = item[4];
    if (!Array.isArray(questions)) continue;

    for (const question of questions) {
      if (!Array.isArray(question) || !Number.isInteger(question[0])) continue;
      const rawOptions = Array.isArray(question[1]) ? question[1] : [];
      const fieldOptions = rawOptions
        .filter((option) => Array.isArray(option) && option.length > 0)
        .map((option) => String(option[0]));

      fields.push(
        makeField({
          title: String(item[1]),
          entryId: Number(question[0]),
          required: Boolean(question[2]),
          options: fieldOptions,
          itemType,
        }),
      );
    }
  }

  const hidden = extractHiddenInputs(pageHtml);
  if (autoPageHistory && sectionLikeCount) {
    hidden.pageHistory = Array.from({ length: sectionLikeCount + 1 }, (_, i) => String(i)).join(',');
    hidden.__page_history_note = `auto pageHistory from ${sectionLikeCount} section/title blocks`;
  }
  hidden.__inferred_page_history = hidden.pageHistory ?? '0';
  hidden.__section_like_count = String(sectionLikeCount);
  hidden.__action_url = getFormAction(pageHtml, formUrl);

  return { fields, hidden, publicData };
}

export function parseCsv(csvText) {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (inQuotes) throw new Error('CSV invalid: quote tidak ditutup.');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  while (rows.length && rows.at(-1).every((value) => value === '')) rows.pop();
  if (!rows.length) throw new Error('CSV kosong atau tidak memiliki data.');

  const headers = rows[0].map((header) => header.trim());
  if (!headers.length || headers.every((header) => header === '')) throw new Error('CSV tidak memiliki header.');

  const objects = rows.slice(1).filter((values) => values.some((value) => value !== '')).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row #${index + 2} memiliki ${values.length} kolom, seharusnya ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });

  if (!objects.length) throw new Error('CSV kosong atau tidak memiliki data.');
  return { headers, rows: objects };
}

export function selectCsvHeaders(csvHeaders, fields) {
  if (csvHeaders.length === fields.length) return csvHeaders;
  if (csvHeaders.length === fields.length + 1 && TIMESTAMP_HEADERS.has(normalizeText(csvHeaders[0]))) {
    return csvHeaders.slice(1);
  }
  throw new Error(
    `Jumlah kolom CSV (${csvHeaders.length}) tidak sama dengan jumlah input Form (${fields.length}). `
      + 'CSV harus punya header sesuai pertanyaan form. Kolom Timestamp di awal akan diabaikan otomatis.',
  );
}

export function valueForField(row, header, field) {
  const rawValue = String(row[header] ?? '').trim();
  if (!field.options.length) return { value: rawValue, note: null };
  if (field.options.includes(rawValue)) return { value: rawValue, note: null };

  const normalized = normalizeText(rawValue);
  const matched = field.options.find((option) => normalizeText(option) === normalized);
  if (matched) return { value: matched, note: `${field.title}: ${JSON.stringify(rawValue).replaceAll('"', "'")} -> ${JSON.stringify(matched).replaceAll('"', "'")}` };

  throw new Error(`Nilai opsi tidak valid untuk field ${JSON.stringify(field.title)}: ${JSON.stringify(rawValue)}. Opsi valid: ${JSON.stringify(field.options)}`);
}

export function buildPayload(row, headers, fields, hidden, options = {}) {
  const { pageHistory = null, namePrefix = '' } = options;
  const payload = {};
  const notes = [];

  for (const [key, value] of Object.entries(hidden)) {
    if (!key.startsWith('__')) payload[key] = value;
  }

  const partialAnswers = [];
  fields.forEach((field, index) => {
    let { value, note } = valueForField(row, headers[index], field);
    if (index === 0 && namePrefix) value = `${namePrefix}${value}`;
    if (field.required && !value) throw new Error(`Field wajib kosong: ${JSON.stringify(field.title)}`);

    payload[field.entryName] = value;
    if (field.options.length) payload[field.sentinelName] ??= '';
    partialAnswers.push([null, field.entryId, [value], 0]);
    if (note) notes.push(note);
  });

  payload.pageHistory = pageHistory || hidden.__inferred_page_history || hidden.pageHistory || '0';
  if (payload.fbzx) payload.partialResponse = JSON.stringify([partialAnswers, null, payload.fbzx]);

  return { payload, notes };
}

export function validateRows(csvHeaders, rows, fields, hidden, options = {}) {
  const selectedHeaders = selectCsvHeaders(csvHeaders, fields);
  const mismatches = [];

  selectedHeaders.forEach((header, index) => {
    const field = fields[index];
    if (normalizeText(header) !== normalizeText(field.title)) {
      mismatches.push(`#${index + 1}: CSV=${JSON.stringify(header)} | Form=${JSON.stringify(field.title)}`);
    }
  });

  if (mismatches.length) {
    throw new Error(`Header CSV tidak cocok dengan judul field Form:\n${mismatches.slice(0, 20).join('\n')}${mismatches.length > 20 ? '\n...' : ''}`);
  }

  let normalizationCount = 0;
  rows.forEach((row, index) => {
    try {
      const { notes } = buildPayload(row, selectedHeaders, fields, hidden, options);
      normalizationCount += notes.length;
    } catch (error) {
      throw new Error(`Validasi gagal pada baris CSV #${index + 1}: ${error.message}`);
    }
  });

  return { selectedHeaders, normalizationCount };
}

export async function fetchForm(formUrl, options = {}) {
  const { timeout = 30_000, autoPageHistory = true } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(formUrl, {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    });
    if (!response.ok) throw new Error(`GET form gagal: HTTP ${response.status}`);
    const html = await response.text();
    return { html, ...parseFormHtml(html, formUrl, { autoPageHistory }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function submitOne(actionUrl, payload, referer, options = {}) {
  const { timeout = 30_000 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(actionUrl, {
      method: 'POST',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        referer,
        origin: 'https://docs.google.com',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload),
    });
    const text = await response.text();
    const successMarkers = [
      'form_confirm',
      'Your response has been recorded',
      'Jawaban Anda telah direkam',
      'Respons Anda telah direkam',
      '您的回答已记录',
      '已记录你的回复',
    ];
    const errorMarkers = [
      'This is a required question',
      'Ini adalah pertanyaan yang wajib diisi',
      '必须回答此问题',
      'Required',
    ];
    const ok = [200, 302].includes(response.status)
      && successMarkers.some((marker) => text.includes(marker))
      && !errorMarkers.some((marker) => text.includes(marker));
    return { ok, status: response.status, snippet: text.slice(0, 500).replace(/\s+/g, ' ') };
  } finally {
    clearTimeout(timeoutId);
  }
}
