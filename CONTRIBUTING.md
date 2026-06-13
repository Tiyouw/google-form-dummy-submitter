# Contributing to gformdummy

Terima kasih atas kontribusimu! 🎉

## Setup

```bash
git clone https://github.com/Tiyouw/google-form-dummy-submitter.git
cd google-form-dummy-submitter
npm install
```

## Development

```bash
# Run tests
npm test

# Run TUI locally
node bin/gformdummy.js

# Run CLI mode
node bin/gformdummy.js --form-url URL --csv data.csv --dry-run
```

## Project Structure

```
src/
  core.js          # Core logic: fetch, parse, validate, submit
  interactive.js   # Inquirer-based wizard
  themes.js        # TUI theme definitions
  tui/
    app.js         # Ink-based TUI component
bin/
  gformdummy.js    # CLI entry point
test/
  core.test.js     # Core logic tests
  cli.test.js      # CLI behavior tests
  tui.test.js      # TUI component tests
  interactive.test.js  # Interactive wizard tests
  update-check.test.js # Update check tests
```

## Guidelines

1. **TDD**: Tulis test dulu, lalu implement
2. **ESM**: Gunakan ES modules (import/export)
3. **No JSX**: Gunakan `React.createElement` (kompatibel ESM tanpa build step)
4. **Test**: Pastikan `npm test` pass sebelum commit
5. **Version**: Bump version di package.json, bin/gformdummy.js, src/tui/app.js

## Menambah Theme

1. Edit `src/themes.js`
2. Tambah entry baru ke `THEMES` object
3. Jalankan `npm test`
4. Commit & push

## Issues

Laporkan bug atau request fitur di:
https://github.com/Tiyouw/google-form-dummy-submitter/issues

## License

MIT
