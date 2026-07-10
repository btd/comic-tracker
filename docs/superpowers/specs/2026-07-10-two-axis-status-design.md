# Two-Axis Status Model — Design

**Date:** 2026-07-10
**Status:** Approved (pending spec review)
**Builds on:** v2 hardening; the single-`status` model.

## Problem

A single `status` field conflates two independent things:
- **My relationship** with the series (am I reading it, caught up, planning to, done, dropped).
- **The series' publication state** (author still releasing, on hiatus, finished, cancelled).

"Reading" collects things I'm not actually reading (no new chapters yet, author paused),
and "On hold" mixes "caught up and waiting" with "plan to look later". Splitting the two
axes removes the ambiguity.

## Data Model

Replace the single `status` with two fields on `Series`:

```ts
type Status = 'reading' | 'caught-up' | 'plan-to-read' | 'completed' | 'dropped';
type Publication = 'ongoing' | 'hiatus' | 'completed' | 'cancelled' | 'unknown';

interface Series {
  // …existing fields…
  status: Status;        // my relationship — drives grid sections
  publication: Publication; // the series' own state — shown as a tag; default 'unknown'
}
```

Meanings:
- `reading` — actively going through it now.
- `caught-up` — read all available chapters, waiting for more.
- `plan-to-read` — intend to start; not begun.
- `completed` — I finished a fully-published series.
- `dropped` — abandoned.
- Publication: `ongoing` (author releasing), `hiatus` (author paused, not finished),
  `completed` (author finished), `cancelled` (axed without proper ending),
  `unknown` (default until set).

## UI

### Sections (grid grouped by personal status, fixed order)
Reading → Caught up → Plan to read → Completed → Dropped. Empty sections are hidden.
Section headings keep the existing count badge styling.

### Card
- Publication shown as a **small muted tag** (e.g. "Ongoing" / "Hiatus" / "Completed" /
  "Cancelled"), placed in the card meta row, visually distinct from the rating stars and
  the section heading. `unknown` renders no tag.
- Rating stars, pin badge, chapter stepper unchanged.

### Form (`SeriesFormModal`)
- Two selects: **My status** (Status values) and **Publication**.
- STATUS_LABEL / PUBLICATION_LABEL maps provide display text.

## Constraints (soft — never block saving)

Implemented as convenience auto-fill + inline non-blocking warnings. Saving always works.

1. **Completed ⇒ publication Completed (auto-fill):** choosing personal `completed` in the
   form auto-sets `publication` to `completed`. The user may change it afterward; if the
   final combination is `completed` + non-`completed` publication, show a small warning.
2. **Caught-up conflict (warn only):** if `status` is `caught-up` and `publication` is
   `completed` or `cancelled`, show a non-blocking warning ("This is finished — did you
   mean Completed?"). No auto-change.
3. Warnings are inline text in the form; they never disable Save.

Rating is left unconstrained (per user).

## Migration / Backfill

Runs in `App.reload()` alongside existing `originalTitle`/`pinned`/`rating` backfills, so
it applies to live IndexedDB data and imported files. Pure mapping in one helper so it's
testable:

| old `status` | → `status` | → `publication` |
|---|---|---|
| `reading` | `reading` | `unknown` |
| `on-hold` | `caught-up` | `unknown` |
| `completed` | `completed` | `completed` |
| `dropped` | `dropped` | `unknown` |
| (any unknown value) | `reading` | `unknown` |

`publication` missing on a record → `unknown`.

## Export / Import

- Envelope version bumps `2 → 3`. Writer emits `3` with `publication` + new `status` vocab.
- `deserialize` accepts versions **1, 2, and 3**:
  - v1/v2 records: map legacy `status` per the migration table; `publication` → `unknown`.
  - v3 records: read `status`/`publication` directly, with safe defaults for bad values.
- Add coercion helpers `statusOf(v)` and `publicationOf(v)` (mirror existing `status()`/
  `bool()` patterns) that map legacy values and fall back safely.
- Update `docs/export-format.md` + `public/export-schema.json`.

## Sorting

Unchanged: rating high→low default, pinned-first within each section.

## Files

Changed:
- `src/types.ts` — `Status` vocab, new `Publication` type + label consts, `publication` field.
- `src/lib/migrateStatus.ts` (new) — pure `migrate(status, publication?)` mapping helper + test.
- `src/exportImport.ts` — version 3, `statusOf`/`publicationOf`, legacy mapping, `publication`.
- `src/App.tsx` — reload backfill via migrate helper; status-section order; pass publication through.
- `src/components/SeriesGrid.tsx` — new section list/order.
- `src/components/SeriesCard.tsx` — publication tag.
- `src/components/SeriesFormModal.tsx` — status + publication selects, auto-fill + warnings.
- `src/App.css` — publication tag styling; section tweaks if needed.
- Tests: `migrateStatus.test.ts`, `exportImport.test.ts` (v1/v2→v3), `db.test.ts` + component
  test `make()` helpers gain `publication`.

## Testing

- `migrateStatus.test.ts` — every legacy value maps correctly; unknown falls back.
- `exportImport.test.ts` — v3 round-trip with `publication`; v2 `on-hold` imports as
  `caught-up` + `unknown`; bad values default; version 3 stamped.
- Component: form auto-fills publication on Completed; warning appears for caught-up +
  completed; grid renders the five sections in order.
- Existing 29 tests stay green (with `publication` added to fixtures).

## Out of Scope

- No new sort options. No changes to pin/rating behavior. Publication is manual only
  (no auto-detection from any source — still no backend/scraping).
