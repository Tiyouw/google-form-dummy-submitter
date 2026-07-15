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

### Shortcut & Tools di TUI

| Tombol | Fungsi |
|---|---|
| `Enter` | Lanjut ke step berikutnya / konfirmasi |
| `b` | Kembali ke step sebelumnya |
| `↑` / `↓` | Pilih opsi / file |
| `t` | Buka/tutup theme picker |
| `p` | Di step CSV: beralih ke file picker |
| `n` | Di step Options: toggle `--no-header` |
| `x` | Buka **Tools menu** dari step mana saja |
| `1` | Tool: Generate CSV template dari form |
| `2` | Tool: Generate 10 baris dummy data otomatis |
| `3` | Tool: Doctor (cek environment, form, CSV) |
| `q` | Keluar dari result screen |
| `r` | Kembali ke awal dari result screen |
| `Ctrl+C` | Keluar |

### Generate Dummy Data Otomatis

Di TUI:
1. Isi Form URL di step pertama.
2. Tekan `x` → tekan `2` (Generate).
3. File `dummy.csv` akan dibuat di direktori kerja.

Atau lewat CLI:

```bash
gformdummy generate --form-url 'https://docs.google.com/forms/d/e/FORM_ID/viewform' --rows 10 --out dummy.csv
```

Contoh hasil generate mendukung opsi form, tanggal, waktu, dan nama Indonesia (`--locale id`).

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
- **Profiles** — simpan dan muat ulang konfigurasi form dengan cepat
- **No external API** — semua proses lokal

---

## Profiles

Simpan konfigurasi form yang sering dipakai. Profile disimpan di `~/.gformdummy.json`.

### TUI

Saat TUI start, pilih profile dari daftar atau tekan `N` untuk mulai baru. Setelah run sukses, TUI akan menanyakan nama untuk menyimpan profile.

### CLI

```bash
# Simpan profile baru
gformdummy profile --save qa --form-url URL --csv data.csv

# Lihat semua profile
gformdummy profile --list

# Jalankan dengan profile
gformdummy --profile qa --dry-run

# Alias melalui subcommand
gformdummy profile --load qa --dry-run

# Hapus profile
gformdummy profile --delete qa

# Simpan otomatis setelah run sukses
gformdummy --form-url URL --csv data.csv --dry-run --save-profile qa
```

### Wizard interaktif (`--interactive`)

Jalankan `gformdummy --interactive`, wizard akan menawarkan load profile di awal dan save profile di akhir.

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
| `--profile <name>` | Muat profile tersimpan. |
| `--save-profile <name>` | Simpan sebagai profile setelah run sukses. |
| `--config <path>` | Path file config, default `~/.gformdummy.json`. |
| `-h, --help` | Bantuan. |
| `-v, --version` | Versi. |

| Subcommand | Keterangan |
|---|---|
| `profile --list` | Tampilkan profile tersimpan. |
| `profile --save <name>` | Simpan profile baru. |
| `profile --load <name>` | Jalankan dengan profile. |
| `profile --delete <name>` | Hapus profile. |

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
