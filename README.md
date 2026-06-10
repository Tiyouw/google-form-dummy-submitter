# gformdummy

TUI & CLI untuk mengisi **Google Form publik** menggunakan data dummy dari CSV.

Dibuat untuk kebutuhan **QA/testing form milik sendiri**: uji response sheet, dashboard, pipeline analisis, demo, atau validasi form.

> [!WARNING]
> Gunakan hanya untuk Google Form yang kamu miliki atau kamu punya izin untuk mengetesnya. Jangan gunakan tool ini untuk memalsukan responden survei nyata atau membuat data dummy terlihat sebagai respons asli.

---

## Install

```bash
npm install -g gformdummy
```

Atau tanpa install global:

```bash
npx gformdummy
```

---

## Quick Start

### TUI Mode (default)

Cukup jalankan tanpa argumen:

```bash
gformdummy
```

TUI akan terbuka dengan:
- ASCII art header
- step navigasi (URL → CSV → Mode → Options → Confirm)
- text input sungguhan yang bisa diketik dan diedit
- pilih mode dry-run / submit
- review sebelum menjalankan
- hasil langsung di terminal

### CLI Mode

Langsung dari argumen:

```bash
gformdummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --dry-run \
  --limit 3
```

Submit 1 row test:

```bash
gformdummy \
  --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' \
  --csv data_dummy.csv \
  --submit \
  --limit 1
```

---

## Fitur

- **TUI interaktif** dengan ASCII art dashboard
- **Text input** sungguhan — bisa diketik, diedit, dihapus
- **Step navigasi** — URL → CSV → Mode → Options → Confirm
- **Mode default dry-run** — aman, tidak submit tanpa konfirmasi
- **Auto pageHistory** — menangani form multi-section
- **Normalisasi opsi** — toleransi dash/spasi otomatis
- **No external API** — semua proses lokal

---

## Format CSV

CSV harus punya header sesuai pertanyaan form.

```csv
Nama,Umur,Jenis Kelamin
Tester A,21,Laki - laki
Tester B,22,Perempuan
```

Tips paling aman:
1. Isi form sekali manual
2. Export response ke CSV
3. Pakai header CSV sebagai template
4. Isi data dummy di bawahnya

---

## Opsi CLI

| Opsi | Keterangan |
|---|---|
| `--form-url` | URL Google Form `/viewform`. Wajib untuk CLI mode. |
| `--csv` | Path file CSV dummy. Wajib untuk CLI mode. |
| `--dry-run` | Validasi saja, tidak submit. Default. |
| `--submit` | Submit response ke Google Form. |
| `--limit` | Batasi jumlah row. |
| `--start` | Mulai dari row tertentu, 1-based. |
| `--delay` | Delay antar submit, default `0.8` detik. |
| `--jitter` | Random delay tambahan, default `0.4` detik. |
| `--encoding` | Encoding CSV, default `utf8`. |
| `--timeout` | HTTP timeout, default `30` detik. |
| `--page-history` | Override manual pageHistory. |
| `--no-auto-page-history` | Matikan inferensi pageHistory. |
| `--name-prefix` | Prefix field pertama. |
| `--preview-rows` | Jumlah preview saat dry-run. |
| `-h, --help` | Bantuan. |
| `-v, --version` | Versi. |

---

## Tentang `pageHistory`

Form multi-section punya hidden field `pageHistory`. Tool ini otomatis menghitung section dan mengirim pageHistory penuh.

Jika kolom akhir kosong setelah submit:
1. Cek output `pageHistory yang dipakai`
2. Coba override manual: `--page-history '0,1,2,3,4,5,6'`
3. Submit 1 row test dulu

---

## Troubleshooting

### `Tidak menemukan FB_PUBLIC_LOAD_DATA_`
- Pastikan URL adalah `/viewform`
- Form harus publik dan tidak butuh login

### `Header CSV tidak cocok`
- Header CSV harus sama dengan judul pertanyaan form
- Urutan harus sama

### `Nilai opsi tidak valid`
- Nilai CSV harus cocok dengan opsi form
- Tool toleransi dash: `2-5 kali` → `2–5 kali`

### Windows: `gformdummy is not recognized`
```bash
npm install -g gformdummy
```
Kalau masih error, cek PATH:
```bash
npm config get prefix
```
Tambahkan folder tersebut ke PATH Windows.

---

## Etika

Dibuat untuk:
- QA/testing form sendiri
- demo pipeline data
- validasi response sheet

Jangan gunakan untuk:
- memalsukan respon survei
- spam form orang lain
- melewati restriksi akses

---

## License

MIT License.
