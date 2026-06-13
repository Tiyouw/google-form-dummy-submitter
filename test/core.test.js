import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  parseFormHtml,
  selectCsvHeaders,
  parseCsv,
  buildPayload,
  fetchForm,
} from '../src/core.js';

const FORM_HTML = `<!doctype html><html><body>
<form action="https://docs.google.com/forms/d/e/TEST/formResponse">
  <input type="hidden" name="fvv" value="1">
  <input type="hidden" name="partialResponse" value="[null,null,&quot;12345&quot;]">
  <input type="hidden" name="pageHistory" value="0">
  <input type="hidden" name="fbzx" value="12345">
</form>
<script>
var FB_PUBLIC_LOAD_DATA_ = [null,["desc",[
  [111,"Intro",null,8,null],
  [222,"Nama",null,0,[[1001,null,1]]],
  [333,"Akses website",null,2,[[1002,[["1 kali",null,null,null,0],["2–5 kali",null,null,null,0]],1]]],
  [444,"Section Akhir",null,8,null],
  [555,"Saya berniat menggunakan kembali",null,5,[[1003,[["1"],["2"],["3"],["4"]],1,["Sangat Tidak Setuju","Sangat Setuju"]]]]
],null,null,null,null,null,null,"Title"],"/forms"];
</script>
</body></html>`;

test('normalizeText handles whitespace, NBSP, and dash variants', () => {
  assert.equal(normalizeText(' 2-5\u00a0kali '), '2-5 kali');
  assert.equal(normalizeText('2–5 kali'), '2-5 kali');
  assert.equal(normalizeText('\nNama  Lengkap '), 'nama lengkap');
});

test('parseFormHtml extracts fields, action URL, hidden inputs, and full page history', () => {
  const { fields, hidden } = parseFormHtml(FORM_HTML, 'https://docs.google.com/forms/d/e/TEST/viewform');

  assert.equal(hidden.__action_url, 'https://docs.google.com/forms/d/e/TEST/formResponse');
  assert.equal(hidden.fvv, '1');
  assert.equal(hidden.fbzx, '12345');
  assert.equal(hidden.pageHistory, '0,1,2');
  assert.equal(hidden.__section_like_count, '2');

  assert.deepEqual(fields.map((field) => field.entryName), ['entry.1001', 'entry.1002', 'entry.1003']);
  assert.equal(fields[1].title, 'Akses website');
  assert.deepEqual(fields[1].options, ['1 kali', '2–5 kali']);
});

test('fetchForm fetches with a user agent and parses the returned form', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let seenUserAgent = '';
  globalThis.fetch = async (_url, options) => {
    seenUserAgent = options.headers['user-agent'];
    return {
      ok: true,
      status: 200,
      async text() {
        return FORM_HTML;
      },
    };
  };

  const { fields, hidden } = await fetchForm('https://docs.google.com/forms/d/e/TEST/viewform');

  assert.match(seenUserAgent, /Mozilla/);
  assert.equal(fields.length, 3);
  assert.equal(hidden.pageHistory, '0,1,2');
});

test('selectCsvHeaders ignores leading timestamp export column', () => {
  const { fields } = parseFormHtml(FORM_HTML, 'https://docs.google.com/forms/d/e/TEST/viewform');
  const headers = ['Timestamp', 'Nama', 'Akses website', 'Saya berniat menggunakan kembali'];

  assert.deepEqual(selectCsvHeaders(headers, fields), headers.slice(1));
});

test('parseCsv supports quoted commas and newlines', () => {
  const csv = 'Nama,Catatan\n"Tester, A","baris 1\nbaris 2"\nTester B,ok\n';
  const { headers, rows } = parseCsv(csv);

  assert.deepEqual(headers, ['Nama', 'Catatan']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Nama, 'Tester, A');
  assert.equal(rows[0].Catatan, 'baris 1\nbaris 2');
});

test('buildPayload normalizes matching option values and includes final section answers', () => {
  const { fields, hidden } = parseFormHtml(FORM_HTML, 'https://docs.google.com/forms/d/e/TEST/viewform');
  const row = {
    Nama: 'Tester A',
    'Akses website': '2-5 kali',
    'Saya berniat menggunakan kembali': '4',
  };

  const { payload: rawPayload, notes } = buildPayload(row, ['Nama', 'Akses website', 'Saya berniat menggunakan kembali'], fields, hidden);

  // Convert pairs array to object for testing
  const payload = Object.fromEntries(rawPayload);

  assert.equal(payload['entry.1001'], 'Tester A');
  assert.equal(payload['entry.1002'], '2–5 kali');
  assert.equal(payload['entry.1003'], '4');
  assert.equal(payload['entry.1002_sentinel'], '');
  assert.equal(payload['entry.1003_sentinel'], '');
  assert.equal(payload.pageHistory, '0,1,2');
  assert.match(payload.partialResponse, /1003/);
  assert.deepEqual(notes, ["Akses website: '2-5 kali' -> '2–5 kali'"]);
});

test('buildPayload rejects invalid choice values', () => {
  const { fields, hidden } = parseFormHtml(FORM_HTML, 'https://docs.google.com/forms/d/e/TEST/viewform');
  const row = {
    Nama: 'Tester A',
    'Akses website': '10 kali',
    'Saya berniat menggunakan kembali': '4',
  };

  assert.throws(
    () => buildPayload(row, ['Nama', 'Akses website', 'Saya berniat menggunakan kembali'], fields, hidden),
    /Nilai opsi tidak valid/
  );
});
