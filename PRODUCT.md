# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Desktop application built with Tauri 2 (system WebView: WebView2 on Windows, WKWebView on macOS). Windows first; macOS and Linux later. Multiple OS windows are part of the product (panes can live in their own windows).

## Users

Both hobbyists and working photographers who shoot on dedicated cameras (Canon first).

- Hobbyists: after a shoot, at a home PC, sort tens to hundreds of shots and file them.
- Professionals (events, sports, and similar): after a job, move thousands of shots quickly into a predictable folder structure for delivery or further editing.

The job in both cases: get files off the camera or card and into the right folders, split the way they want, without manual sorting.

## Product Purpose

seiton (整頓, "putting in order") is an import tool. It exists to make importing, folder structure, and partitioning simple: decide once how files should be laid out (by date, hour, rating, file type, and which formats to keep per rating), then import with that layout.

Success: the user plugs in a camera or card, confirms what to take, and ends up with files in the intended folders without touching them by hand.

## Positioning

Specialized in importing, not in editing or cataloguing. Where general photo managers treat import as a step before their library, seiton's whole surface is the import itself: file layout and partitioning are the product, set up in a few choices (simple mode) or a folder template (advanced mode). Ratings and previews exist to decide what to import and where it goes.

## Operating Context

- Camera connected by USB (MTP/PTP) or its card in a card reader.
- Browse thumbnails and previews, adjust star ratings (ratings set on the camera are read and take priority), then import.
- Import settings: formats to keep per rating (RAW only / JPG + RAW / JPG only), destination root, folder layout (date, hour, rating, RAW/JPG split, or a template).
- Import runs with visible progress; source media is never modified or deleted.

## Capabilities and Constraints

- Read-only access to cameras and cards; ratings are written only to the imported copies (XMP).
- Initial camera support: Canon (CR3, CR2, JPG, HIF, MP4, MOV, CRM); other makers are added through TOML profiles.
- Panes: Thumbnails, Preview, Import Settings. Each exists once; it can be docked in the main window or moved to its own window and docked back.
- Language: English-first interface. Supplementary text (hints, explanations) in Japanese. The product must support both Japanese and English.
- Undecided: logo and visual identity assets (none yet).

## Brand Commitments

- Name: seiton (整頓).
- Visual direction pinned by the user: bright (light) and simple, with no "AI-generated" look.
- No logo yet; do not invent one.

## Evidence on Hand

- No real photos, customers, testimonials, or benchmarks. The UI currently runs on synthetic mock data (`ui/src/mock/`), which must stay labelled as mock data.
- Architecture and plan: `docs/architecture.md`, `docs/plan.md`.

## Product Principles

1. Import first: every screen serves getting files into the right place.
2. The folder layout is visible before anything is copied: show where files will go.
3. Never risk the source: cameras and cards are read-only.
4. Simple by default, precise when needed: checkboxes first, templates for those who want them.
5. Fast for thousands of files, calm for dozens.

## Accessibility & Inclusion

No specific accessibility standard was required. Keyboard operation and screen-reader labels already exist and should be kept. The interface must work in both Japanese and English.
