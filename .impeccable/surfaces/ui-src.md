---
version: 1
slug: "ui-src"
primary_target: "ui/src"
related_targets: []
---

# Surface brief: library (main window and pane windows)

## Scope

`ui/src` library surface: main window (Devices, Windows, Thumbnails, Preview, Import Settings, status bar, import dialog) and the pane windows. Mode: Operate.

## Audience and task

Hobbyists and working photographers, after a shoot, deciding what to take off the camera or card and where it goes. Task: skim frames, mark ratings, set the folder layout once, import. Frequency: every shoot; tens to thousands of frames.

## Constraints

- Bright and simple, no AI-generated look (user-pinned).
- English-first labels, Japanese for supplementary text; Japanese and English both supported.
- Existing function, keyboard support and labels stay.

## Direction contract

THESIS: The library is a contact sheet on a light table: numbered frames in a strict grid, marked by hand. It refuses the dark photo-editor workspace and the card-grid dashboard.

OWN-WORLD: Paper-white sheet on a light-gray table; ink near-black; hairline frame rules; frame numbers in tabular figures under every frame; one grease-pencil red used only for marks (stars, picks, selection box, the import action). Settings read like a lab order form: labelled rows, ruled lines, tick boxes.

STORY: The user sees every frame numbered like a strip, marks the good ones in red, fills in the order form (formats, destination, folders), and sends the order. They trust that nothing on the card changes.

FIRST VIEWPORT: Left, a narrow index column (Devices, Windows) on the table gray. Center, the contact sheet: frames edge-aligned in a grid, frame number and file types beneath each, red stars. Right, Preview over the order form. Bottom rule: progress left, red "Import" at right.

FORM: Contact sheet with grease-pencil marks; position 1 on the ordered list; seed key 631e694e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Logo: none yet; the wordmark is plain text.
