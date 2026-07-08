# Comic Tracker — Export / Import Format

Comic Tracker's **Export** button downloads a single self-contained JSON file
(`comic-tracker-export-YYYY-MM-DD.json`). **Import** reads that same file. The file
holds your entire list, with uploaded cover images inlined as base64 so it is portable
across machines and browsers with no external dependencies.

A machine-readable JSON Schema (Draft 2020-12) is published at a stable URL and shipped
with the app:

- **Hosted:** <https://btd.github.io/comic-tracker/export-schema.json>
- **In the repo:** [`public/export-schema.json`](../public/export-schema.json) (copied to
  the site root at build time).

The schema's `$id` matches the hosted URL, so validators can resolve it by reference.

## Envelope

```json
{
  "app": "comic-tracker",
  "version": 2,
  "exportedAt": 1751932800000,
  "series": [ /* … */ ]
}
```

| Field | Type | Notes |
|---|---|---|
| `app` | `"comic-tracker"` | Fixed marker. Import rejects files where this differs. |
| `version` | `1` \| `2` | Writer emits `2`; reader accepts `1` and `2`. Other values are rejected. |
| `exportedAt` | integer (epoch ms) | When the file was written. Informational; ignored on import. |
| `series` | array | The tracked titles (see below). |

Unknown top-level fields are ignored (forward-compatible).

## Series record

```json
{
  "id": "b3f1c2a4-5e6d-4f7a-8b9c-0d1e2f3a4b5c",
  "title": "Solo Leveling",
  "originalTitle": "나 혼자만 레벨업",
  "author": "Chugong",
  "link": "https://www.webtoons.com/en/action/solo-leveling/list?title_no=3162",
  "linkLabel": "Webtoons",
  "lastChapter": 180,
  "status": "reading",
  "coverType": "url",
  "coverUrl": "https://example.com/cover.jpg",
  "createdAt": 1700000000000,
  "updatedAt": 1751900000000,
  "pinned": true
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string (non-empty) | generated | Stable unique id; de-dupes on merge import. Auto-generated (UUID) if absent; must be non-empty if present. |
| `title` | string (non-empty) | — | **Required.** Primary/English title. |
| `originalTitle` | string | `""` | Optional original-language title. Absent in v1 files. |
| `author` | string | `""` | |
| `link` | string | `""` | URL to the series page. |
| `linkLabel` | string | `""` | Display label for the link, e.g. `"Webtoons"`. |
| `lastChapter` | number ≥ 0 | `0` | Negative values are clamped to `0`. |
| `status` | `reading` \| `completed` \| `on-hold` \| `dropped` | `reading` | Unrecognized → `reading`. |
| `coverType` | `url` \| `file` \| `none` | `none` | Selects which cover field applies. Unrecognized → `none`. |
| `coverUrl` | string | `""` | Direct image URL. Used when `coverType` is `"url"`. |
| `coverDataUrl` | string (`data:…`) | — | Base64 data URL of an **uploaded** cover. Present only when `coverType` is `"file"`. Makes the export self-contained. |
| `createdAt` | integer (epoch ms) | import time | Defaults to import time if missing or `0`. |
| `updatedAt` | integer (epoch ms) | import time | Defaults to import time if missing or `0`. |
| `pinned` | boolean | `false` | Pin to top of list. Absent in v1 files → `false`. |

`title` is required and non-empty; `id` is auto-generated when absent (but rejected if
present-and-empty). Every other field is coerced to a safe default if missing or the
wrong type. Unknown record fields are ignored.

## Import behavior

- **Validation.** The file must parse as JSON, have `app: "comic-tracker"`, a `version`
  of `1` or `2`, and `series` as an array. Each record must have a non-empty `title`
  (and, if `id` is present, it must be non-empty). Any failure aborts the import with a
  descriptive message and writes nothing.
- **Cover images.** A `coverType: "file"` record's `coverDataUrl` is decoded back into a
  stored image. `coverType: "url"` uses `coverUrl` directly. `"none"` shows a placeholder.
- **Merge vs. Replace.** Import offers two modes:
  - **Merge** — records are upserted by `id` (an imported record overwrites an existing
    one with the same `id`; others are kept).
  - **Replace all** — clears the current list first, then loads the file (with an
    in-app Undo available immediately afterward).

## Version compatibility

| | v1 | v2 (current) |
|---|---|---|
| `pinned` field | absent | present |
| `originalTitle` | absent | present |
| Read by current app | ✅ (missing fields defaulted) | ✅ |

A v2 reader imports v1 files transparently (`pinned` → `false`, `originalTitle` → `""`).
There is no v1 writer in the current app; exports are always v2.
