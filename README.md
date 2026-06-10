# gform-dummy

CLI Node.js untuk mengisi **Google Form publik** menggunakan data dummy dari CSV.

Dibuat untuk kebutuhan **QA/testing form milik sendiri**: uji response sheet, dashboard, pipeline analisis, demo, atau validasi form.

> [!WARNING]
> Gunakan hanya untuk Google Form yang kamu miliki atau kamu punya izin untuk mengetesnya. Jangan gunakan tool ini untuk memalsukan responden survei nyata atau membuat data dummy terlihat sebagai respons asli.

---

## Nama package

Nama yang dipakai untuk versi npm CLI:

```txt
gform-dummy
```

Alasannya:

- pendek dan mudah diketik;
- command terminal juga sama: `gform-dummy`;
- lebih mudah diingat dibanding nama panjang;
- credit tetap ada di `author`, GitHub repo, dan README.

---

## Fitur

- Membaca pertanyaan Google Form langsung dari URL `/viewform`.
- Mengambil otomatis `entry.<id>` Google Forms.
- Membaca data dari CSV.
- Validasi jumlah field, header CSV, field wajib, dan pilihan jawaban.
- Mode default **dry-run**, jadi aman dicek dulu sebelum submit.
- Submit bertahap: 1 row test dulu, lalu sisanya.
- Menangani banyak form multi-section dengan `pageHistory` penuh.
- Menambahkan sentinel dan `partialResponse` agar direct POST lebih mirip submit dari browser.
- Tidak membutuhkan dependency eksternal untuk versi Node CLI.

---

## Kebutuhan

- Node.js 18+
- Internet access
- Google Form harus bisa diakses publik tanpa login
- Tidak mendukung CAPTCHA, upload file, atau form yang wajib login Google

---

## Install

### Opsi 1 — Install dari GitHub sekarang

Karena package belum dipublish ke npm registry, install dari GitHub dulu:

```bash
npm install -g github:Tiyouw/google-form-dummy-submitter
```

Cek:

```bash
gform-dummy --help
```

### Opsi 2 — Jalankan tanpa global install dari GitHub

```bash
npx github:Tiyouw/google-form-dummy-submitter --help
```

### Opsi 3 — Setelah publish ke npm registry nanti

Kalau package `gform-dummy` sudah dipublish ke npm:

```bash
npm install -g gform-dummy
```

atau:

```bash
npx gform-dummy --help
```

---

## Format CSV

CSV harus memiliki header yang sesuai dengan pertanyaan Google Form.

Contoh sederhana:

```csv
Nama,Umur,Jenis Kelamin,Berapa kali Anda pernah mengakses website iPlant.id?
Tester A,21,Laki - laki,1 kali
Tester B,22,Perempuan,2-5 kali
```

Aturan penting:

1. Urutan kolom CSV harus sama dengan urutan pertanyaan form.
2. Header CSV harus sama dengan judul pertanyaan form, tetapi script menoleransi perbedaan whitespace, NBSP, dan jenis dash.
3. Jika CSV hasil export Google Forms memiliki kolom awal `Timestamp` / `Stempel waktu`, script akan mengabaikannya otomatis.
4. Untuk pilihan jawaban, nilai CSV harus cocok dengan opsi form.
5. Perbedaan dash umum bisa dinormalisasi otomatis, misalnya:

```txt
2-5 kali -> 2–5 kali
```

Cara paling aman membuat template CSV:

1. Isi Google Form sekali secara manual.
2. Buka Google Sheet Responses.
3. Export sebagai CSV.
4. Pakai header CSV tersebut sebagai template.
5. Isi data dummy di baris-baris berikutnya.

---

## Cara Pakai

### 1. Dry-run dulu

Dry-run hanya validasi dan preview payload. Tidak ada data yang dikirim.

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --dry-run \
  --limit 3
```

Output sukses kira-kira seperti ini:

```txt
OK: 100 baris CSV valid.
OK: 42 field Form cocok dengan 42 kolom CSV.
OK: pageHistory yang dipakai: "0,1,2,3,4,5,6".
Mode: DRY RUN
DRY row #1: ...
Selesai.
```

### 2. Submit 1 row test

Submit satu row dulu agar kamu bisa cek di Google Sheet Responses apakah semua kolom, terutama kolom akhir, sudah terisi.

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --limit 1 \
  --delay 0 \
  --jitter 0
```

Opsional, tambahkan prefix agar row test mudah dicari:

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --limit 1 \
  --name-prefix 'TEST_'
```

### 3. Submit sisa row

Kalau row test sudah aman, submit dari row ke-2:

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --start 2 \
  --delay 0.35 \
  --jitter 0.25
```

Kalau mau submit semua dari awal:

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --delay 0.35 \
  --jitter 0.25
```

---

## Opsi CLI

| Opsi | Keterangan |
|---|---|
| `--form-url` | URL Google Form `/viewform`. Wajib. |
| `--csv` | Path file CSV dummy. Wajib. |
| `--dry-run` | Validasi saja, tidak submit. Default jika `--submit` tidak diberikan. |
| `--submit` | Benar-benar submit response ke Google Form. |
| `--limit` | Batasi jumlah row yang diproses. |
| `--start` | Mulai dari row data tertentu, 1-based, tidak termasuk header. |
| `--delay` | Delay dasar antar submit, default `0.8` detik. |
| `--jitter` | Delay random tambahan, default `0.4` detik. |
| `--encoding` | Encoding CSV, default `utf8`. |
| `--timeout` | HTTP timeout dalam detik, default `30`. |
| `--page-history` | Override manual `pageHistory`, contoh `0,1,2,3,4,5,6`. |
| `--no-auto-page-history` | Matikan inferensi otomatis pageHistory. |
| `--name-prefix` | Prefix untuk field pertama, berguna saat test 1 row. |
| `--preview-rows` | Jumlah row preview saat dry-run. |
| `--help` | Tampilkan bantuan. |
| `--version` | Tampilkan versi. |

---

## Tentang `pageHistory` dan form multi-section

Google Form multi-section bisa punya hidden field:

```txt
pageHistory=0
```

Kalau direct POST hanya memakai `pageHistory=0`, Google kadang tetap mengembalikan halaman sukses, tetapi jawaban di section akhir bisa kosong/diabaikan.

Tool ini mencoba mengatasi dengan:

1. Menghitung block section/title dari metadata form.
2. Mengirim `pageHistory` penuh, misalnya:

```txt
0,1,2,3,4,5,6
```

3. Mengirim sentinel untuk field pilihan/skala.
4. Membuat `partialResponse` dari semua jawaban.

Tetap lakukan verifikasi response sheet setelah submit 1 row test, terutama kolom-kolom terakhir.

Jika masih ada kolom akhir kosong, coba override manual:

```bash
gform-dummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --dry-run \
  --page-history '0,1,2,3,4,5,6'
```

Lalu submit dengan opsi yang sama.

---

## Development

Clone repo:

```bash
git clone https://github.com/Tiyouw/google-form-dummy-submitter.git
cd google-form-dummy-submitter
npm test
npm run check
```

Jalankan lokal tanpa install global:

```bash
node bin/gform-dummy.js --help
```

Cek isi package npm:

```bash
npm pack --dry-run
```

---

## Troubleshooting

### `Tidak menemukan FB_PUBLIC_LOAD_DATA_`

Kemungkinan:

- URL bukan `/viewform`
- Form wajib login
- Form tidak publik
- Google mengubah struktur HTML

Pastikan URL seperti ini:

```txt
https://docs.google.com/forms/d/e/FORM_ID/viewform
```

### `Header CSV tidak cocok`

Pastikan header CSV sama dengan pertanyaan form dan urutannya sama.

Cara paling mudah:

1. Buat 1 response manual di form.
2. Export response ke CSV.
3. Pakai header CSV tersebut sebagai template.
4. Isi data dummy di bawahnya.

### `Nilai opsi tidak valid`

Nilai CSV harus cocok dengan opsi di form.

Contoh jika opsi form adalah:

```txt
1 kali
2–5 kali
Lebih dari 5 kali
```

maka nilai CSV harus salah satu dari opsi tersebut. Tool menoleransi dash umum seperti `2-5 kali` menjadi `2–5 kali`, tetapi tidak menebak opsi yang berbeda total.

### HTTP `200` tapi data tidak masuk sempurna

Jangan hanya percaya HTTP `200`. Selalu cek Google Sheet Responses.

Jika kolom akhir kosong:

- Pastikan memakai versi terbaru.
- Cek output `pageHistory yang dipakai`.
- Coba `--page-history` manual.
- Submit 1 row test dulu dengan `--name-prefix TEST_`.

---

## Etika Penggunaan

Tool ini dibuat untuk:

- QA/testing form sendiri
- demo pipeline data
- uji dashboard
- validasi response sheet
- simulasi load ringan dengan izin

Jangan gunakan untuk:

- memalsukan respon survei nyata
- menaikkan jumlah responden secara tidak jujur
- spam form orang lain
- melewati login/CAPTCHA/restriksi akses

---

## Legacy Python Script

Repo ini awalnya dibuat dari script Python (`google_form_dummy_submitter.py`). Versi utama sekarang adalah Node.js CLI `gform-dummy` agar mudah dipasang via npm. Script Python tetap ada di repo sebagai referensi/legacy.

---

## License

MIT License. Lihat [LICENSE](LICENSE).
