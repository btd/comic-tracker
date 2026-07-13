# Comic Tracker — Backup Format

Comic Tracker's **Export** button downloads a `.zip` backup
(`comic-tracker-export-YYYY-MM-DD.zip`). **Import** reads that same `.zip`. The archive
separates metadata, data, and images into distinct entries; uploaded cover images are
stored as raw binary files (no base64 bloat).

A machine-readable JSON Schema for the archive's JSON entries is published at a stable
URL and shipped with the app:

- **Hosted:** <https://btd.github.io/comic-tracker/export-schema.json>
- **In the repo:** [`public/export-schema.json`](../public/export-schema.json)

> Backups produced before this format (plain `.json`) are **not** importable.

## Archive layout

```
meta.json            { app: "comic-tracker", formatVersion: 1, exportedAt: <epoch ms> }
data.json            { series: SeriesRecord[] }
covers/<id>.<ext>    raw image bytes — one per record with coverType "file"
```

- **meta.json** is the self-describing header. Import reads it first and checks
  `app === "comic-tracker"` and `formatVersion`. `formatVersion` (currently **1**) is the
  single source of truth for how the rest of the archive is interpreted.
- **data.json** holds the series array (see the record table below).
- **covers/** holds one binary image per file-cover, named `<series.id>.<ext>` where
  `<ext>` is derived from the image MIME type (`webp`, `jpg`, `png`, `gif`, or `bin`).

## Series record (in `data.json`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string (non-empty) | generated | Stable id; de-dupes on merge import. |
| `title` | string (non-empty) | — | **Required.** |
| `originalTitle` | string | `""` | Optional original-language title. |
| `author` | string | `""` | |
| `link` | string | `""` | URL to the series page. |
| `lastChapter` | number ≥ 0 | `0` | Clamped to ≥ 0. |
| `rating` | number 0–5 (½ steps) | `0` | Personal rating. |
| `status` | `reading` \| `caught-up` \| `plan-to-read` \| `completed` \| `dropped` | `reading` | My relationship with the series. |
| `publication` | `ongoing` \| `hiatus` \| `completed` \| `cancelled` \| `unknown` | `unknown` | The series' own state. |
| `coverType` | `url` \| `file` \| `none` | `none` | Selects which cover field applies. |
| `coverUrl` | string | `""` | Used when `coverType` is `"url"`. |
| `coverFile` | string | — | Filename in `covers/`. Present only when `coverType` is `"file"`. |
| `createdAt` | integer (epoch ms) | import time | |
| `updatedAt` | integer (epoch ms) | import time | |
| `pinned` | boolean | `false` | Pin to top of its section. |

Only `title` is strictly required; other fields coerce to safe defaults. Unknown fields
are ignored.

## Import behavior

- **Validation.** The file must be a valid zip containing `meta.json` (with
  `app: "comic-tracker"` and a supported `formatVersion`) and `data.json` (with a
  `series` array). Any failure aborts the import with a descriptive message; nothing is
  written.
- **Covers.** A `coverType: "file"` record's `coverFile` is loaded from `covers/` and
  re-attached as the stored image. If the referenced file is missing, that one record
  degrades to `coverType: "none"` — the rest of the import still succeeds.
- **Merge vs. Replace.** Merge upserts by `id`; Replace all clears the current list
  first (with an in-app Undo immediately afterward).

## Size

Because cover images are stored as raw (already-compressed) bytes instead of base64
inside JSON, a backup is roughly 25% smaller than the old JSON format, and `data.json`
itself is tiny (metadata only). The bulk of the archive is the image bytes.
