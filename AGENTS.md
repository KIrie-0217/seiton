# AGENTS.md

Guidance for AI coding agents (and humans) working on seiton. Read this before changing code.

## What this is

seiton is a desktop app (Tauri 2 + Rust + React/TypeScript) for importing photos and videos from a camera or SD card into a folder layout the user defines. Product context is in [PRODUCT.md](PRODUCT.md). The architecture is in [docs/architecture.md](docs/architecture.md), and the task plan and progress are in [docs/plan.md](docs/plan.md).

The UI currently runs on an in-memory **mock backend** (`ui/src/mock/`). The Rust side for devices, metadata and import is being built task by task (plan Tasks 4–13).

## Setup

- Node.js 24 is pinned in `.nvmrc`. Run `nvm use` in every new shell; nvm's default here may be older, and Vite 8 needs 20.19 or newer.
- The project `.npmrc` points at the public npm registry.
- Rust stable. Tauri prerequisites for your OS.
- Pin new dependencies to exact versions (`npm install --save-exact`, `=x.y.z` in `Cargo.toml` workspace dependencies).

## Commands

| Task | Command |
|---|---|
| UI with mock data in a browser | `npm run dev:mock` → http://localhost:1420 |
| Tauri app with mock data (real OS windows) | `npm run tauri:mock` |
| Tauri app (real backend so far: folder scan only) | `npm run tauri dev` |
| Frontend unit tests (Vitest, jsdom) | `npm test` |
| Lint / typecheck | `npm run lint` / `npm run typecheck` |
| End-to-end tests (Playwright, Chromium) | `npm run e2e:install` once, then `npm run e2e` (`npm run e2e:ui` to debug) |
| Rust | `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all` |

Before you commit, run lint, typecheck, `npm test`, `npm run e2e`, `cargo test --workspace` and clippy. CI (Windows) runs all of them.

Useful URL parameters for the mock UI:

- `?mock=fast` removes simulated latency.
- `?lang=ja` or `?lang=en` forces a locale.
- Pane windows open with `?pane=thumbnails|preview|import`.

## Repository layout

- `crates/` Rust libraries (device access, profiles, metadata, scheduler, cache, transfer). See architecture §4.2.
- `src-tauri/` the Tauri app. `src/dto.rs` defines every type shared with the UI.
- `ui/src/`
  - `api.ts`: command calls. `setBackendOverride` routes them to the mock.
  - `controls.tsx`: wrappers over React Aria (IconButton, SelectField, Checkbox).
  - `i18n.tsx`: all UI text.
  - `library/`: devices, contact sheet, preview.
  - `importing/`: settings, dialog, progress, template and plan logic.
  - `windowing/`: split view, pane windows, cross-window bus, docking.
  - `mock/`: mock data and backend.
  - `bindings/`: generated; never edit by hand.
- `e2e/`: Playwright specs and `helpers.ts`.
- `profiles/`: bundled camera profiles (TOML).
- `.kiro/skills/impeccable/`: the vendored design skill. `.impeccable/` holds its project records.
- `docs/`: English documents (authoritative). `docs/ja/` holds Japanese translations.

## Rules that are easy to break

- **Never write to the source.** Cameras and cards are read-only. Nothing may modify or delete files on them.
- **Shared types come from Rust.** Change `src-tauri/src/dto.rs`, then run `cargo test --workspace` to regenerate `ui/src/bindings/`, and commit the result. CI fails on stale bindings. `u64` fields need `#[ts(type = "number")]`.
- **UI text lives in `ui/src/i18n.tsx`.**
  - Labels (headings, buttons, field names, options, pane names) are English in every locale.
  - Supplementary text (hints, explanations, empty states, errors, status sentences) exists in both English and Japanese. Add both whenever you add one.
  - Logic returns codes (`TemplateErrorCode`, `ImportProblem`), not sentences.
- **Use React Aria for controls.** Use React Aria Components through `controls.tsx` rather than raw `<button>`, `<select>` or `<input>`. Style them in `ui/src/styles.css` with React Aria's data attributes (`[data-selected]`, `[data-focus-visible]`, `[data-hovered]`, `[data-disabled]`).
  - Labels that contain React Aria's hidden inputs (Checkbox, Radio) must stay `position: relative`. Otherwise clicking them scrolls the window; `e2e/layout.spec.ts` guards this.
- **Follow the design world.** The design is a contact sheet on a light table: white sheets on a gray table, near-black ink, hairline rules, and numbered frames. Red (`--mark`) is only for marks: stars, the selection box and the Import action.
  - No gradients, glass, card grids, eyebrow labels or emoji icons. Icons are drawn SVG in `icons.tsx`.
  - The binding references are `PRODUCT.md` and `.impeccable/surfaces/ui-src.md`. For design work, use the impeccable skill (`.kiro/skills/impeccable/SKILL.md`) and run its detector: `.kiro/skills/impeccable/scripts/impeccable detect --json ui/src`.
- **Panes exist once.** Thumbnails, Preview and Import Settings are each docked, in their own window, or hidden. Cross-window state goes through the `Bus` (`windowing/bus.ts`). Per-pane state such as filters and scroll position stays local.
- **Mock data must look like mock data.** Placeholder thumbnails carry a `MOCK` label; never make them look like real photos.

## Testing

- **Unit tests (Vitest, jsdom)** cover logic and component behaviour.
  - `ui/src/test/desktop.tsx` simulates several windows in one document.
  - `ui/src/test/helpers.ts` provides `installFakeLayout()` (needed by React Aria's Virtualizer), `chooseOption()` for Selects, and `frame()` for grid rows.
  - jsdom has no layout, scrolling or real focus scrolling. Check those in E2E.
- **E2E tests (Playwright)** run against the mock UI on port 1430; Playwright starts the server itself.
  - Use roles and accessible names (`getByRole(..., { exact: true })` where names overlap, e.g. "Import" vs "Import Settings").
  - Click a checkbox's visible label (`.checkbox` with `hasText`), not React Aria's hidden input.
  - Failures leave traces in `test-results/`; open one with `npx playwright show-trace <file>`.
- **Out of reach for Playwright:** the real Tauri app and OS-level window dragging (docking). On macOS the WebView (WKWebView) cannot be automated. Verify those manually with `npm run tauri:mock`.

## Driving the UI as an agent (Playwright MCP)

`.kiro/settings/mcp.json` registers the Playwright MCP server (`@playwright/mcp`, pinned). It is limited to `localhost:1420` and `localhost:1430`, and uses an isolated browser profile with a 1280×800 viewport. Output goes to `.playwright-mcp/`, which is gitignored.

1. Start the UI: `npm run dev:mock`. Keep it running in its own terminal.
2. Navigate to `http://localhost:1420/?mock=fast` (add `&lang=ja` for Japanese).
3. Prefer the accessibility snapshot over screenshots to find elements. Every control has a role and a name: the grid "Frames", rows "IMG_0001, Frame 1", the listbox "Devices", the regions "Thumbnails", "Preview" and "Import Settings", and the button "Import".
4. When you reproduce a bug this way, turn the steps into a spec in `e2e/` so it stays fixed.
5. Stop any dev server you started when you are done; it holds the port.

## Commits and docs

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, …), with the subject in the imperative and at most 50 characters. Stage specific files.
- The repository is public. No secrets, personal paths or internal URLs.
- This repository's commit email is set locally (`git config --local user.email`). Do not change git config.
- Documents are written in English first. When you change `docs/architecture.md` or `docs/plan.md`, update the matching file in `docs/ja/`. If you cannot, add a line at the top of the Japanese file saying it is out of date.
- Update the task table in `docs/plan.md` when a task's status changes.
