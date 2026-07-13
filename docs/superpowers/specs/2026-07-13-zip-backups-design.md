# Zipped Backups (fflate) — Design

**Date:** 2026-07-13
**Status:** Approved (pending spec review)
**Replaces:** the base64 JSON export/import (`exportImport.ts`, envelope v1–v3).

## Goal

Make backups a compact, inspectable `.zip` that separates **metadata**, **data**, and
**images** into distinct entries. Uploaded cover images are stored as raw binary files
(no base64 tax); the container is self-describing via a versioned `meta.json`.

**No backward compatibility.** Existing IndexedDB data exports fine to the new format;
old `.json` backups are NOT importable. The old export/import code is removed.

## Dependency

Add **fflate** (^0.8) — small, fast, tree-shakeable zip lib. Use `zipSync` / `unzipSync`
(synchronous; data volumes are tiny and it keeps the code simple). Works under jsdom/Node
so tests run directly.

## Zip structure

```
meta.json            { app: "comic-tracker", formatVersion: 1, exportedAt: <epoch ms> }
data.json            { series: SeriesRecord[] }
covers/<id>.<ext>    raw image bytes — only for records with coverType === "file"
```

- **meta.json** is the self-describing header. The reader opens it first and checks
  `app === "comic-tracker"` and `formatVersion`. `formatVersion` (starts at **1**) is
  the single source of truth for how to interpret `data.json` + `covers/`. It is
  independent of the app's internal data schema and of the retired envelope lineage.
- **data.json** holds the series array. Each record is a `Series` minus `coverBlob`:
  - `coverType: "file"` → carries `coverFile: "<id>.<ext>"`, no image bytes inline.
  - `coverType: "url"` → keeps `coverUrl`.
  - `coverType: "none"` → neither.
- **covers/** holds one binary entry per file-cover, named `<series.id>.<ext>` where
  `<ext>` derives from the blob MIME (`image/webp`→`webp`, `image/jpeg`→`jpg`,
  `image/png`→`png`, else `bin`).

## New module: `src/lib/backup.ts`

Isolated, single-responsibility, no React/IDB imports.

```ts
createBackup(series: Series[]): Promise<Blob>
```
- Build `meta` (app, formatVersion 1, exportedAt).
- Build `data.series`: for each series, strip `coverBlob`; if `coverType === "file"` and a
  blob exists, add `coverFile` and queue `covers/<id>.<ext>` bytes (via `blob.arrayBuffer()`).
- `zipSync` the entries → return a `Blob` (`type: "application/zip"`).

```ts
readBackup(file: Blob): Promise<Series[]>
```
- `unzipSync` the file bytes.
- Parse `meta.json`; throw if missing, `app` wrong, or `formatVersion` unsupported.
- Parse `data.json`; for each record, coerce fields with safe defaults (reuse the same
  coercion approach the old deserialize used: required `title`; `status`/`publication`
  via existing `migrateStatus`; numeric/bool/rating guards). Rebuild `coverBlob` from the
  matching `covers/` entry (MIME from ext). A referenced-but-missing cover → drop to
  `coverType: "none"` (don't fail the whole import for one missing image; note in spec).
- Return `Series[]`.

Errors are thrown with descriptive messages; the caller (ImportDialog) shows them and
writes nothing on failure.

## Removals

- Delete `src/exportImport.ts` and `src/exportImport.test.ts`.
- Remove `serialize`/`deserialize` imports/usages in `App.tsx` (replace with
  `createBackup`/`readBackup`).
- `migrateStatus` stays (now imported by `backup.ts`).
- Keep `src/lib/thumbnail.ts` (upload downscaling) and `src/lib/cover.ts` unchanged.

## App wiring

- `handleExport`: `const blob = await createBackup(series)` → download
  `comic-tracker-export-<YYYY-MM-DD>.zip` → stamp `lastBackupAt` (unchanged behavior).
- `ImportDialog`: `readBackup(file)` on drop or picked file. No content sniffing, no
  legacy branch. `accept=".zip,application/zip"`. Merge/Replace modes unchanged.

## Error handling

Descriptive thrown errors for: not a valid zip, missing `meta.json`, wrong `app`,
unsupported `formatVersion`, malformed `data.json`. A missing referenced cover degrades
that one record to `coverType: "none"` rather than aborting.

## Testing (`src/lib/backup.test.ts`)

- Round-trip: file-cover series → zip → back; `coverBlob` bytes identical; `data.json`
  contains no base64 / no `[object Blob]`.
- URL cover and `none` cover round-trip correctly.
- `readBackup` rejects: a non-zip blob; a zip missing `meta.json`; wrong `app`; unknown
  `formatVersion`.
- Missing referenced cover → record imported as `coverType: "none"`, import still succeeds.
- Legacy `status` value in `data.json` (e.g. `on-hold`) still maps via `migrateStatus`
  (defensive, even though we write current values).
- fflate runs under the existing jsdom + Blob-polyfill setup; verify `blob.arrayBuffer()`
  is available (the test-setup polyfill already adds it).

## Docs

- Rewrite `docs/export-format.md` to describe the zip layout + `meta.json.formatVersion`.
- Replace `public/export-schema.json` with a schema for `meta.json` + `data.json`
  (the record shape), served at the same stable URL.

## Files

New: `src/lib/backup.ts`, `src/lib/backup.test.ts`.
Changed: `src/App.tsx` (wiring), `src/components/ImportDialog.tsx` (accept `.zip`, call
`readBackup`), `package.json` (fflate), `docs/export-format.md`, `public/export-schema.json`.
Deleted: `src/exportImport.ts`, `src/exportImport.test.ts`.

## Out of Scope

- No backward-compatible import of old JSON backups (explicit decision).
- No `counts` in meta (derivable from data).
- No streaming/async zip (data is small). No Brotli/custom extension.
