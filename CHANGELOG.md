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
