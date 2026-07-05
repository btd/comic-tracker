# Comic Tracker — Design

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Purpose

A personal browser app to track manga/manhwa the user is reading. Not a reader —
tracking only. The most frequent operation is incrementing the last-read chapter.
Data must be exportable and importable as a self-contained file.

## Constraints

- Pure browser app. No backend, no server process.
- Runs with `npm install` + `npm run dev`.
- All data (including uploaded images) persists locally in the browser.
- No external UI component library. Icons come from `lucide-react`.

## Stack & Versions

Verified against the npm registry on 2026-07-05.

| Package | Version | Role |
|---|---|---|
| vite | ^8.1.3 | Build/dev server |
| react / react-dom | ^19.2.7 | UI |
| @vitejs/plugin-react | ^6.0.3 | React plugin |
| typescript | ^6.0.3 | Types |
| vitest | ^4.1.9 | Unit tests |
| idb | ^8.0.3 | IndexedDB wrapper |
| lucide-react | ^1.23.0 | Icons |

- Node requirement (Vite 8): `^20.19.0 || >=22.12.0`. Dev machine runs Node 24. ✓
- Modern JSX transform (no per-file `import React`).

## Data Model

One entity, `Series`:

```ts
type Status = 'reading' | 'completed' | 'on-hold' | 'dropped';
type CoverType = 'url' | 'file' | 'none';

interface Series {
  id: string;            // crypto.randomUUID()
  title: string;
  author: string;        // may be empty
  link: string;          // URL to series page; may be empty
  linkLabel: string;     // optional display label, e.g. "Webtoons"
  lastChapter: number;   // >= 0
  status: Status;
  coverType: CoverType;
  coverUrl: string;      // used when coverType === 'url'
  coverBlob?: Blob;      // used when coverType === 'file', stored in IndexedDB
  createdAt: number;     // epoch ms
  updatedAt: number;     // epoch ms
}
```

Notes:
- `coverBlob` is stored as a real `Blob` in IndexedDB (idb handles this natively).
  In the UI it is shown via a short-lived `URL.createObjectURL` object URL that is
  revoked when no longer needed.
- On **export**, a `coverBlob` is converted to a base64 data URL so the export is a
  single self-contained JSON file portable across machines/browsers.

## Storage — `src/db.ts`

Thin wrapper over `idb`. One object store `series` keyed by `id`.

Exposed functions (all async, all typed):
- `getAll(): Promise<Series[]>`
- `get(id): Promise<Series | undefined>`
- `put(series): Promise<void>` (insert or update)
- `remove(id): Promise<void>`
- `bulkPut(list): Promise<void>` (used by import merge)
- `clear(): Promise<void>` (used by import replace-all)

This module is the single source of truth for persistence and is unit-tested in
isolation (fake-indexeddb under Vitest).

## Export / Import — `src/exportImport.ts`

Pure logic module, no DOM/IDB dependency (takes/returns data), unit-tested.

- **Export format** — a versioned JSON envelope:
  ```json
  { "app": "comic-tracker", "version": 1, "exportedAt": <ms>, "series": [ ...SeriesExport ] }
  ```
  where `SeriesExport` is a `Series` with any `coverBlob` replaced by a
  `coverDataUrl` (base64) field and `coverBlob` omitted.
- **Functions:**
  - `serialize(list: Series[]): Promise<string>` — blob → base64 data URL, returns JSON string.
  - `deserialize(json: string): Promise<Series[]>` — validates envelope + each record,
    base64 data URL → Blob. Throws a descriptive `Error` on malformed/incompatible input.
- **Validation:** unknown `app`/`version` mismatch, missing required fields, and bad
  types are rejected with a clear message surfaced to the user. Extra/unknown fields
  are ignored (forward-compatible).

The DOM glue (trigger file download, read a chosen file) lives in the component
layer, not here, so this module stays pure and testable.

## UI

Single page. No routing.

### Toolbar (`Toolbar`)
- Search box (filters by title, case-insensitive substring).
- Status filter dropdown (All / Reading / Completed / On-hold / Dropped).
- Sort dropdown (Recently updated [default] / Title A–Z / Chapter high→low).
- `+ Add` button (`Plus`).
- `Export` button (`Download`) — serializes all series, triggers a `.json` download
  named `comic-tracker-export-<date>.json`.
- `Import` button (`Upload`) — opens `ImportDialog`.

### Grid (`SeriesGrid` → `SeriesCard`)
- Responsive card grid.
- Each `SeriesCard` shows:
  - Cover image (object URL for blob, or `coverUrl`, or a placeholder when `none`).
  - Title + author.
  - Status badge (color-coded).
  - `Ch. N` with a large **[+]** (`Plus`) increment button — the primary action.
    One click: `lastChapter += 1`, `updatedAt = now`, persisted immediately.
  - A small **[–]** (`Minus`) for corrections (floored at 0).
  - Edit (`Pencil`) and Delete (`Trash2`) actions.
  - Clicking cover/title opens `link` in a new tab (`target=_blank`,
    `rel="noopener noreferrer"`) when a link exists.
- Empty state: friendly message + Add prompt when no series match / none exist.

### Add / Edit modal (`SeriesFormModal`)
- Fields: title (required), author, link, linkLabel, lastChapter (number, min 0),
  status (select), cover.
- Cover input: radio/toggle between "Image URL" (text field) and "Upload file"
  (file picker, image/*). Small live preview.
- Save validates title non-empty and chapter >= 0. Sets `createdAt` on create and
  `updatedAt` on every save. Close on `X` (`X` icon) or backdrop/Escape.

### Import dialog (`ImportDialog`)
- File picker for a `.json` export.
- After a valid file is parsed, choose mode:
  - **Merge** — `bulkPut` by `id` (imported records overwrite same-id existing).
  - **Replace all** — `clear` then `bulkPut`, behind an explicit confirm ("This
    deletes your current list").
- Parse/validation errors shown inline; nothing is written on error.

## Component Boundaries

```
App
 ├─ Toolbar          (search/filter/sort state up in App; export/import triggers)
 ├─ SeriesGrid
 │   └─ SeriesCard   (increment/decrement/edit/delete callbacks)
 ├─ SeriesFormModal  (add/edit)
 └─ ImportDialog
```

- `App` owns the in-memory `Series[]`, loads from `db` on mount, and is the only
  component that calls `db`. Children receive data + callbacks.
- `db.ts` and `exportImport.ts` have no React dependency.

## Error Handling

- DB failures surface a non-blocking error banner; the app stays usable with
  whatever is in memory.
- Import errors are shown in the dialog and abort the write.
- Broken image URLs fall back to the placeholder via `<img onError>`.

## Testing

- `db.test.ts` — CRUD, bulkPut, clear against `fake-indexeddb`.
- `exportImport.test.ts` — round-trip serialize/deserialize (incl. blob↔base64),
  rejection of malformed envelopes, forward-compatible extra fields.
- Components kept thin; no component tests required for v1.

## Explicitly Out of Scope (YAGNI)

- Server-side / cross-site image scraping and metadata auto-fetch.
- Multi-device sync, accounts, cloud storage.
- In-app reading.
- Tags, ratings, reading history/timeline.
- Routing / multiple pages.
