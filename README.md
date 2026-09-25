# seiton

A desktop app that brings order (整頓, *seiton*) to the photos and videos on your camera: review them with previews and star ratings, then import them into the folder layout you define.

> Status: early development. See [docs/plan.md](docs/plan.md) for progress. 日本語: [docs/ja/README.md](docs/ja/README.md)

## Features (planned)

- Detects a connected camera automatically, over USB (MTP/PTP) or through an SD card reader
- Lists photos and videos with thumbnails and previews, and lets you rate them with stars
  - Ratings set on the camera (EXIF/XMP Rating) are read and take priority
  - The camera or card is never written to
- Rule-based import
  - For example: JPG only for 1-star shots, JPG and RAW for 2-star shots
  - RAW and JPG in separate folders
  - Folder layouts by date, hour, rating or file type, or a template such as `D:\Photos\{yyyy}-{MM}-{dd}`
  - Copies are verified by hash, and ratings are written to the copies (embedded XMP for JPEG, `.xmp` sidecars for RAW)
- Videos play inside the app, or open in the OS default app when the format is not supported

Windows and Canon cameras come first; macOS, Linux and other makers follow.

## Tech stack

- [Tauri 2](https://tauri.app/) + Rust (cargo workspace)
- React + TypeScript (Vite), [React Aria Components](https://react-spectrum.adobe.com/react-aria/) for UI controls
- SQLite (catalog), [ExifTool](https://exiftool.org/) (metadata)

## Development

Requirements: Rust (stable), Node.js 24 (`.nvmrc`; run `nvm use`), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```sh
npm ci
npm run tauri dev       # run the app
npm run dev:mock        # the UI with mock data in a browser (http://localhost:1420)
npm run tauri:mock      # the Tauri app with mock data (real windows)
npm test                # frontend unit tests (Vitest)
npm run lint            # ESLint
npm run e2e:install     # once: download Chromium for Playwright
npm run e2e             # end-to-end tests in Chromium (Playwright)
cargo test --workspace  # Rust tests; also regenerates the TypeScript types in ui/src/bindings
cargo clippy --workspace --all-targets -- -D warnings
```

Types shared between the UI and Rust are defined in `src-tauri/src/dto.rs`. `cargo test` generates matching TypeScript types in `ui/src/bindings/` (ts-rs). Commit the generated files; CI fails if they are stale.

Layout:

- `crates/` Rust libraries ([architecture](docs/architecture.md) §4.2)
- `src-tauri/` the Tauri app
- `ui/` the React + TypeScript frontend
- `e2e/` Playwright end-to-end tests

Working with an AI coding agent? Start with [AGENTS.md](AGENTS.md).

## Documents

- [Architecture (docs/architecture.md)](docs/architecture.md)
- [Implementation plan (docs/plan.md)](docs/plan.md)
- [Product context (PRODUCT.md)](PRODUCT.md)
- Japanese translations: [docs/ja/](docs/ja/)

## License

[MIT](LICENSE)
