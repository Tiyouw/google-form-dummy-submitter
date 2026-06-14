## v1.19.0 (2026-06-14)
### Added
- **Field mapping**: `--mapping mapping.json` untuk custom mapping CSV headers ke form fields
- **Mapping storage**: Auto-save di `~/.gformdummy/mappings/` per form
- **Enhanced doctor**: More checks (required fields, option validation, unsupported fields)
- **JSON output**: `gformdummy doctor --json` untuk CI integration

### Doctor Checks
- Node.js version
- Package version
- Internet connection
- Config/reports directory
- Form accessible + metadata
- Required fields detected
- Header matching result
- Option value validation
- Unsupported field detection

## v1.16.0 (2026-06-14)
### Added
- **Dummy generator**: `gformdummy generate --form-url URL --rows 50` — generate valid dummy CSV from form
- **Locale support**: `--locale id` for Indonesian names, cities, divisions
- **Smart field detection**: Auto-detect field type from title (nama, email, phone, dll)
- **Form options priority**: Generator uses actual form options first, then smart defaults

## v1.15.0 (2026-06-14)
### Added
- **Radio/Multiple choice support**: itemType 3 — single value submission
- **Checkbox support**: itemType 4 — comma-separated multi-select
- **Radio grid support**: itemType 7 variant — single value per row

## v1.14.0 (2026-06-14)
### Added
- **CSV template generator**: `gformdummy template --form-url URL` — generate CSV template dari form fields
- **Doctor command**: `gformdummy doctor --form-url URL --csv PATH` — cek environment, form accessible, CSV valid
- **Enhanced dry-run report**: Field matching summary, required field check, option validation

## v1.13.0 (2026-06-14)
### Added
- **Progress per-row di TUI**: Nama row, status, counter sukses/gagal/retry
- **Retry failed rows**: `--retry N` (default 3) dengan exponential backoff
- **Failed rows export**: Gagal rows otomatis tersimpan ke CSV di `~/.gformdummy/reports/`
- **--stop-on-error**: Stop submit di baris pertama yang gagal

### Fixed
- `--retry` flag sekarang ter-pass ke config dengan benar

## v1.12.0 (2026-06-14)
### Fixed
- **CRITICAL: Submit 400 error** — Date/Time fields now use correct format (year/month/day and hour/minute)
- **Duplicate payload entries** — Skip sentinel, pageHistory, partialResponse from hidden inputs (we generate ourselves)
- **Clean preview table** — Max 8 columns, 14-char width, scrolling, show all

## v1.11.0 (2026-06-14)
### Fixed
- **Multi-select payload**: Checkbox grid values (e.g. "Kolom 1, Kolom 2") now submit correctly with duplicate keys
- **CSV tanpa header**: `--no-header` flag untuk CSV tanpa header row, positional mapping ke form fields
- **Preview table**: Tabel CSV dengan kolom aligned, scrolling (↑↓), dan show all (a)

### Improved
- Auto-detect CSV tanpa header dengan warning
- Better error messages dengan tip `--no-header`
- `buildPayload` returns pairs array (supports duplicate keys for multi-select)

## v1.10.0 (2026-06-14)
### Fixed
- **Name-based header matching**: CSV headers matched to form fields by name, not position
- **Multi-select support**: Comma-separated checkbox values (e.g. "Kolom 1, Kolom 2") handled correctly
- **Header detection**: Warning when CSV first row looks like data, not header
- **Preview timing**: CSV preview now shows reliably before mode selection
- **Back from error**: Tekan `r` untuk kembali ke awal setelah error (tidak harus keluar)

### Improved
- Partial header matching: "Petak Kotak Centang [Baris 1]" matches "Petak Kotak Centang"
- Better error messages with full field/header comparison

# Changelog

## v1.9.0 (2026-06-10)
### Added
- **Custom themes**: 6 themes (sunset, ocean, forest, purple, matrix, monokai) — tekan `t` di TUI
- **CSV file picker**: tekan `p` di step CSV untuk browse file CSV di direktori
- **Export report**: hasil run otomatis tersimpan di `~/.gformdummy/reports/`
- **Results history**: tampilkan 3 run terakhir di step URL
- **--theme flag**: `gformdummy --theme ocean` untuk CLI mode
- Themes tersimpan di config, konsisten antar sesi

## v1.8.0 (2026-06-10)
### Added
- **Real-time validation**: URL & CSV divalidasi saat ketik
- **CSV preview**: lihat 5 baris pertama sebelum submit
- **Progress spinner**: animasi saat proses berjalan
- **Config file**: simpan recent configs di `~/.gformdummy.json`

## v1.7.0 (2026-06-10)
### Changed
- Compact chrome-style ASCII art logo (1 blok)

## v1.6.0 (2026-06-10)
### Changed
- oh-my-logo style ASCII art with gradient colors

## v1.5.1 (2026-06-10)
### Fixed
- Cleaner ASCII art banner for Windows CMD compatibility

## v1.5.0 (2026-06-10)
### Added
- Auto update check notification

## v1.4.0 (2026-06-10)
### Added
- Full TUI with text input, dashboard, step navigation

## v1.3.0 (2026-06-10)
### Added
- Default TUI mode (no flags needed)

## v1.2.0 (2026-06-10)
### Added
- Interactive wizard with inquirer

## v1.1.0 (2026-06-10)
### Added
- --interactive flag for guided mode

## v1.0.0 (2026-06-10)
### Added
- Initial release
- CLI mode with --form-url, --csv, --submit, --dry-run
- Auto pageHistory inference
- CSV parsing and payload building
