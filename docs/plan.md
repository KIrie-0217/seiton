# seiton implementation plan

> English is the authoritative version. A Japanese translation lives in [docs/ja/plan.md](ja/plan.md).

For design details, see [architecture.md](architecture.md). Each task should leave the build and tests passing upon completion.

| # | Task | Status |
|---|---|---|
| 0 | Repository creation and placement of design and plan documents | Done |
| 1 | Project foundation | Done |
| 2 | Connection abstraction, SD card reading, profiles, and classification | Done |
| 3 | UI creation with mock data | Done |
| 3.1 | Split view, multiple windows, and import settings (mock stage) | Done |
| 3.2 | Design refresh (impeccable), migration to React Aria, Japanese/English support, E2E tests | Done (DESIGN.md and the remaining design-review items are open) |
| 4 | Metadata reading with ExifTool | Not started |
| 5 | Catalog (SQLite) and rating sync | Not started |
| 6 | IO scheduler and cache | Not started |
| 7 | Replace thumbnail grid with real data | Not started |
| 8 | Zoom preview and video playback | Not started |
| 9 | Path templates, rule engine, and plan preview | Not started |
| 10 | Execute copy | Not started |
| 11 | Windows MTP connection | Not started |
| 12 | Device auto-detection | Not started |
| 13 | Settings screen and distribution preparation | Not started |

---

## Task 0: Repository creation and placement of design and plan documents

- Purpose: Create an initial repository containing only design and plan documents, and publish it on GitHub.
- Contents: `README.md`, `docs/architecture.md`, `docs/plan.md`, `LICENSE` (MIT), `.gitignore` (Rust / Node / Tauri).
- Demo: README, design, and plan documents are viewable on GitHub, and mermaid diagrams render.

## Task 1: Project foundation

- Purpose: Set up a buildable, testable state with Tauri 2 + React/TS (Vite) + Rust workspace (empty crates).
- Contents: `crates/*` scaffolds, clippy / rustfmt / ESLint / Vitest / `cargo test`, GitHub Actions (windows-latest). Pin dependency versions.
- Tests: Minimal tests in each crate.
- Demo: The app launches and displays the version on screen via a Rust command.

## Task 2: Connection abstraction, SD card reading, profiles, and classification

- Purpose: Read a specified folder (SD card), group RAW + JPEG pairs, and display them in a list.
- Contents:
  - `DeviceSource` / `SourceCaps` definitions
  - `FsSource` (listing, range reads, `local_path`), `FakeSource` for testing
  - `CameraProfile` and TOML loader (schema versioning, validation, override in user folder)
  - `generic-dcf.toml` / `canon.toml`, Resolver
- Tests: Classification and pairing via directory dumps, profile detection, invalid TOML detection.
- Demo: When an SD card is specified via folder selection, a per-pair list is displayed.

## Task 3: UI creation with mock data

- Purpose: Enable UI interaction testing without real data.
- Contents:
  - Define DTOs between UI ⇔ Rust (`AssetView`, `DeviceView`, `RatingUpdate`, etc.) and generate TypeScript types via ts-rs / specta
  - About 50 mock items using `mockIPC` from `@tauri-apps/api/mocks` (with capture dates, ratings, placeholder images, and simulated load delays)
  - Device list, virtual-scrolling thumbnail grid (TanStack Virtual; maintain virtualization as we assume thousands of items), star assignment and filtering (keyboard support and accessibility), detail panel
  - Toggle via `VITE_USE_MOCK`
- Tests: Rating operations, filtering, keyboard interactions with Vitest + Testing Library.
- Demo: With `npm run dev:mock`, browse, assign stars, and filter in the browser.

## Task 3.1: Split view, multiple windows, and import settings (mock stage)

- Purpose: Build out panel split view, external windows, import settings, and import operations at the mock stage (since they affect the UI skeleton).
- Contents (details in architecture.md §9.1, §9.2):
  - Panels (Thumbnails / Preview / Import Settings). Main layout: Thumbnails on the left; Preview and Import Settings stacked vertically on the right
  - Move panels to/from external windows (icon, close window, drag external windows over the main window). Each panel is unique within the app. Closing the main window closes all external windows
  - Display names in English (Devices / Windows / Thumbnails / Preview / Import Settings). Panel interactions use icons
  - Enlarge stars in grid cells; click to change rating. Stars are shown as gauge display
  - Inter-window sync: shared state (device, selection, focus), `assetsUpdated`, `importSettingsUpdated`, `importProgress`
  - Import settings (save format, destination, simple folder structure/templates), import dialog, progress in status bar
  - In mock mode, use real Tauri window APIs (`npm run tauri:mock`)
  - Reflect scheduler `set_viewport` design per window (implementation in Task 6)
- Tests: Split boundaries (left-right, top-bottom), layout, panel move and restore, one window per type, window docking by drag (dock vs. place side-by-side without docking vs. no docking on open), hide and re-show, inter-window sync, star click and gauge display, template expansion and validation, save format detection, import plan, dialog "all" linkage and start conditions, import execution/completion/cancel.
- Demo: With `npm run tauri:mock`, move Preview to a separate window and return it (drag the window over the main). In Import Settings, set destination and folder structure; starting from "Import" shows progress in the status bar and marks items as imported upon completion.

## Task 3.2: Design refresh, React Aria, Japanese/English support, E2E tests

- Purpose: Adopt a bright, simple look without AI-like aesthetics; replace custom components with a UI library; support Japanese and English; prepare E2E tests in a real browser.
- Contents:
  - Add impeccable skill to `.kiro/skills/impeccable/`. Create `PRODUCT.md` and record the direction (contact sheet) in `.impeccable/surfaces/ui-src.md`
  - Replace components with React Aria Components (list uses `GridList` + `Virtualizer`). Remove TanStack Virtual
  - Internationalization (labels in English; supplemental text in English or Japanese; switch via Language)
  - Playwright E2E (`e2e/`, `npm run e2e`, Windows job in CI) and Playwright MCP (`.kiro/settings/mcp.json`)
  - Summarize agent instructions in `AGENTS.md`, move Japanese documents to `docs/ja/`, and make English authoritative
  - Let the sidebar be hidden (button and Ctrl/⌘+B)
- Remaining: Design review feedback (Import Settings partially off-screen, list density, Preview gaps, Preview when nothing selected) and `DESIGN.md` creation
- Tests: 70 Vitest cases, 13 Playwright cases.

## Task 4: Metadata reading with ExifTool

- Purpose: Display capture date/time, model, body serial, and rating in the list.
- Contents:
  - Upfront pre-validation of metadata-related items (architecture.md §10)
  - Manage ExifTool with `-stay_open` (start, recovery, timeout)
  - Pass leading bytes read via `read_range` through stdin
  - Retrieve rating in order of profile's `rating_tags`
  - Connect real data (FS source) to the UI from Task 3
- Tests: Validate values using sample files shot on real hardware (fixtures).
- Demo: Capture date/time and stars are shown in the list.

## Task 5: Catalog (SQLite) and rating sync

- Purpose: Persist ratings and synchronize with camera priority.
- Contents: rusqlite + migrations, upsert by identifier key, camera-priority overwrite via `camera_rating` / `app_rating` / `app_base_rating`, command to assign ratings in the app.
- Tests: Unit tests for all sync patterns (core), integration tests for the catalog.
- Demo: Stars assigned in the app survive restart. Re-reading after changing ratings on the camera updates to the camera's values.

## Task 6: IO scheduler and cache

- Purpose: Operate priority, epoch-based cancellation, coalescing, and 3-tier cache.
- Contents: `IoScheduler` (single worker per device, P0–P3, per-window `set_viewport` / `close_viewport`), in-memory LRU, disk cache (limit, SQLite management), cache keys.
- Tests: Verify priority order, dropping old epochs, coalescing, and no device access on cache hits using `FakeSource` with delays.
- Demo: Show pending and completed counts in real time on a dev screen.

## Task 7: Replace thumbnail grid with real data

- Purpose: Replace the mock UI from Task 3 with real data (`thumb://`, scheduler).
- Contents: `thumb://` custom protocol (cache → scheduler), thumbnail retrieval chain (embedded → Windows Shell), detect visible range via `IntersectionObserver` and call `set_viewport` (~100ms debounce).
- Tests: Unit tests for the retrieval chain, UI tests.
- Demo: Even with fast scrolling, visible items are prioritized; re-display is instant from cache.

## Task 8: Zoom preview and video playback

- Purpose: Zoomed photo display and in-window video playback.
- Contents: Extract RAW-embedded preview JPEG, play via `<video>` (FS uses asset protocol), open in default app on failure. Upfront verification of WebView2 playback support.
- Tests: Preview extraction (fixtures), UI tests for playback failure fallback.
- Demo: Zoomed photo display, MP4 playback, open formats like CRM in the default app.

## Task 9: Path templates, rule engine, and plan preview

- Purpose: Configure rules and preview the copy plan in advance.
- Contents:
  - Implement template syntax (architecture.md §9.2) and import plan calculation in Rust (`seiton-core`), replacing the UI mock implementation (TypeScript)
  - Rules: conditions (stars, type) and actions (which types to save, destination per type)
  - Conflict policy: overwrite (default; skip if identical content) / skip / sequential numbering
  - `TransferPlan` generation, rule editing UI, plan preview (tree, counts, overwrite counts, required capacity)
- Tests: Unit tests for templates and rules (boundary values, forbidden characters, Windows path length).
- Demo: Setting "1 star = JPG only, 2 stars = JPG + RAW, RAW goes to date folder on D drive" displays a plan tree.

## Task 10: Execute copy

- Purpose: Copy according to plan, verify, and write ratings.
- Contents: Chunked reads at P2 (P0 can interrupt), BLAKE3 computation and post-write verification, temp file → atomic rename, XMP writing (JPEG embedded / RAW `.xmp` sidecar), import history, progress display and cancellation.
- Tests: `FakeSource` → temp folder for conflict policies, detection of verification mismatches, cancel and resume.
- Demo: Actual import from SD card; items are marked as imported.

## Task 11: Windows MTP connection

- Purpose: Enable the same functionality as SD cards for USB-connected Canon cameras.
- Contents: Upfront verification of WPD partial reads on real hardware. Use `windows` crate for WPD listing and range reads, `WPD_RESOURCE_THUMBNAIL`, download videos to cache before playback, declare capabilities.
- Tests: Verification of listing and identifier keys via dumps, manual test procedures for real hardware.
- Demo: Connect Canon via cable and perform listing, preview, rating, and import.

## Task 12: Device auto-detection

- Purpose: Automatically recognize devices on connection.
- Contents: `DeviceWatcher` (WPD device notifications, volume arrival and DCIM detection), automatic profile selection via Resolver, stop processing queue on removal and reflect in UI.
- Tests: State transitions for connect/disconnect events using `FakeWatcher`.
- Demo: SD card insertion or camera connection automatically displays the device.

## Task 13: Settings screen and distribution preparation

- Purpose: Make the app ready for distribution.
- Contents: Settings screen (cache limit and deletion, user profile folder, default on conflict), bundle ExifTool and third-party license notice screen, installer (MSI / NSIS via Tauri bundler), document code signing procedure.
- Tests: Smoke test after installation.
- Demo: From an installed app, run through connection to import.

## Out of scope (future)

- macOS (ImageCaptureCore, volume monitoring, AVFoundation thumbnails)
- Linux (libmtp)
- Maker SDK implementations (WIP)
