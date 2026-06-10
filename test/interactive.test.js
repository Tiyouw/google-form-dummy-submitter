import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromptRunConfig, resolveRunConfig } from '../src/interactive.js';
import { parseFormHtml, parseCsv, buildPayload, selectCsvHeaders } from '../src/core.js';

const FORM_HTML = `<!doctype html><html><body>
<form action="https://docs.google.com/forms/d/e/TEST/formResponse">
  <input type="hidden" name="fvv" value="1">
  <input type="hidden" name="pageHistory" value="0">
  <input type="hidden" name="fbzx" value="12345">
</form>
<script>
var FB_PUBLIC_LOAD_DATA_ = [null,["desc",[
  [222,"Nama",null,0,[[1001,null,1]]],
  [333,"Akses website",null,2,[[1002,[["1 kali",null,null,null,0],["2–5 kali",null,null,null,0]],1]]]
],null,null,null,null,null,null,"Title"],"/forms"];
</script>
</body></html>`;

const CSV_TEXT = `Nama,Akses website
Tester A,2-5 kali
Tester B,1 kali
`;

test('buildPromptRunConfig returns config summary for valid wizard inputs', async () => {
  const { fields, hidden } = parseFormHtml(FORM_HTML, 'https://docs.google.com/forms/d/e/TEST/viewform');
  const { headers, rows } = parseCsv(CSV_TEXT);
  const selectedHeaders = selectCsvHeaders(headers, fields);
  const preview = buildPayload(rows[0], selectedHeaders, fields, hidden);

  const answers = {
    formUrl: 'https://docs.google.com/forms/d/e/TEST/viewform',
    csvPath: '/tmp/sample.csv',
    mode: 'dry-run',
    limit: 2,
    encoding: 'utf8',
    autoPageHistory: true,
    pageHistoryOverride: '',
    confirm: true,
  };

  const config = await buildPromptRunConfig({
    answers,
    formMeta: { fields, hidden },
    csv: { headers: selectedHeaders, rows },
    previewPayload: preview.payload,
  });

  assert.equal(config.formUrl, answers.formUrl);
  assert.equal(config.csvPath, answers.csvPath);
  assert.equal(config.submit, false);
  assert.equal(config.limit, 2);
  assert.equal(config.previewFieldCount, fields.length);
  assert.equal(config.previewRowCount, rows.length);
});

test('resolveRunConfig fills defaults and validates required values', () => {
  const answers = {
    formUrl: ' https://example.com/viewform ',
    csvPath: '/tmp/sample.csv ',
    mode: 'submit',
    limit: '',
    encoding: '',
    autoPageHistory: true,
    pageHistoryOverride: '',
    confirm: true,
  };

  const config = resolveRunConfig(answers);

  assert.equal(config.formUrl, 'https://example.com/viewform');
  assert.equal(config.csvPath, '/tmp/sample.csv');
  assert.equal(config.submit, true);
  assert.equal(config.limit, null);
  assert.equal(config.encoding, 'utf8');
  assert.equal(config.confirm, true);
});

test('resolveRunConfig rejects empty required fields', () => {
  assert.throws(
    () => resolveRunConfig({ formUrl: '', csvPath: '', mode: 'dry-run', limit: '', encoding: '', autoPageHistory: true, pageHistoryOverride: '', confirm: false }),
    /formUrl wajib diisi/,
  );
});
