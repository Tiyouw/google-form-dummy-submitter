# Google Form Dummy Submitter

Tool Python sederhana untuk mengisi **Google Form publik** menggunakan data dummy dari CSV.

Dibuat untuk kebutuhan **QA/testing form milik sendiri**: misalnya menguji alur response sheet, validasi pertanyaan, dashboard, pipeline analisis, atau demo.

> [!WARNING]
> Gunakan hanya untuk Google Form yang kamu miliki atau kamu punya izin untuk mengetesnya. Jangan gunakan tool ini untuk memalsukan responden survei nyata atau membuat data dummy terlihat sebagai respons asli.

---

## Fitur

- Membaca pertanyaan Google Form langsung dari URL `/viewform`.
- Mengambil otomatis `entry.<id>` Google Forms.
- Membaca data dari CSV.
- Validasi jumlah field, header CSV, field wajib, dan pilihan jawaban.
- Mode default **dry-run**, jadi aman dicek dulu sebelum submit.
- Mendukung submit bertahap: 1 row dulu, lalu sisanya.
- Menangani banyak form multi-section dengan `pageHistory` penuh.
- Menambahkan sentinel dan `partialResponse` agar direct POST lebih mirip submit dari browser.

---

## Kebutuhan

- Python 3.10+
- Internet access
- Google Form harus bisa diakses publik tanpa login
- Tidak mendukung CAPTCHA, upload file, atau form yang wajib login Google

Install dependency:

```bash
pip install -r requirements.txt
```

Atau tanpa clone repo:

```bash
pip install requests
```

---

## Instalasi

```bash
git clone https://github.com/Tiyouw/google-form-dummy-submitter.git
cd google-form-dummy-submitter
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
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

---

## Cara Pakai

### 1. Dry-run dulu

Dry-run hanya validasi dan preview payload. Tidak ada data yang dikirim.

```bash
python google_form_dummy_submitter.py \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --dry-run \
  --limit 3
```

Output sukses kira-kira seperti ini:

```txt
OK: 100 baris CSV valid.
OK: 42 field Form cocok dengan 42 kolom CSV.
OK: pageHistory yang dipakai: '0,1,2,3,4,5,6'.
Mode: DRY RUN
DRY row #1: ...
Selesai.
```

### 2. Submit 1 row test

Submit satu row dulu agar kamu bisa cek di Google Sheet Responses apakah semua kolom, terutama kolom akhir, sudah terisi.

```bash
python google_form_dummy_submitter.py \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --limit 1 \
  --delay 0 \
  --jitter 0
```

Opsional, tambahkan prefix agar row test mudah dicari:

```bash
python google_form_dummy_submitter.py \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --limit 1 \
  --name-prefix 'TEST_'
```

### 3. Submit sisa row

Kalau row test sudah aman, submit dari row ke-2:

```bash
python google_form_dummy_submitter.py \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --start 2 \
  --delay 0.35 \
  --jitter 0.25
```

Kalau mau submit semua dari awal:

```bash
python google_form_dummy_submitter.py \
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
| `--submit` | Benar-benar submit data ke Google Form. |
| `--limit` | Batasi jumlah row yang diproses. |
| `--start` | Mulai dari row data tertentu, 1-based, tidak termasuk header. |
| `--delay` | Delay dasar antar submit, default `0.8` detik. |
| `--jitter` | Delay random tambahan, default `0.4` detik. |
| `--encoding` | Encoding CSV, default `utf-8-sig`. |
| `--page-history` | Override manual `pageHistory`, contoh `0,1,2,3,4,5,6`. |
| `--no-auto-page-history` | Matikan inferensi otomatis pageHistory. |
| `--name-prefix` | Prefix untuk field pertama, berguna saat test 1 row. |
| `--preview-rows` | Jumlah row preview saat dry-run. |

---

## Tentang `pageHistory` dan form multi-section

Google Form multi-section bisa punya hidden field:

```txt
pageHistory=0
```

Kalau direct POST hanya memakai `pageHistory=0`, Google kadang tetap mengembalikan halaman sukses, tetapi jawaban di section akhir bisa kosong/diabaikan.

Script ini mencoba mengatasi dengan:

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
python google_form_dummy_submitter.py \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --dry-run \
  --page-history '0,1,2,3,4,5,6'
```

Lalu submit dengan opsi yang sama.

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

maka nilai CSV harus salah satu dari opsi tersebut. Script menoleransi dash umum seperti `2-5 kali` menjadi `2–5 kali`, tetapi tidak menebak opsi yang berbeda total.

### HTTP `200` tapi data tidak masuk sempurna

Jangan hanya percaya HTTP `200`. Selalu cek Google Sheet Responses.

Jika kolom akhir kosong:

- Pastikan memakai versi script terbaru.
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

## License

MIT License. Lihat [LICENSE](LICENSE).
