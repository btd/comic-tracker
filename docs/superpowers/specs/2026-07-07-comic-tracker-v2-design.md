# Comic Tracker v2 (Hardening Release) — Design

**Date:** 2026-07-07
**Status:** Approved (pending spec review)
**Builds on:** `docs/superpowers/specs/2026-07-05-comic-tracker-design.md`

## Purpose

Harden the working v1 tracker: protect against data loss, make it installable and
offline-capable (PWA), deploy it publicly (GitHub Pages + CI), add a handful of
high-value UX affordances, and shore up engineering hygiene. **Sync is explicitly
deferred to its own future spec.**

## Global Constraints (unchanged from v1)

- Pure browser app, no backend, no server process.
- Runs with `npm install` + `npm run dev`; builds with `npm run build`.
- All data (incl. images) persists locally in IndexedDB.
- No external UI component library. Icons from `lucide-react`.

## New / Updated Dependencies

Verified against npm registry on 2026-07-07.

| Package | Version | Role |
|---|---|---|
| vite-plugin-pwa | ^1.3.0 | Service worker + manifest (Workbox). Supports Vite 8. |
| workbox-window | ^7.4.1 | Update-prompt glue (peer of the plugin). |
| @testing-library/react | ^16.3.2 | Component tests. Supports React 19. |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers. |
| @testing-library/user-event | ^14.6.1 | User interaction simulation. |
| @testing-library/dom | ^10 | Peer of RTL. |

Node requirement unchanged (Vite 8: `^20.19.0 || >=22.12.0`); dev machine Node 24. ✓

---

## 1. Data Model & Storage Changes

### Series — add one field
```ts
interface Series {
  // ...all v1 fields...
  pinned: boolean; // NEW — pinned series sort before unpinned
}
```

### New app-level metadata
A separate IndexedDB object store `meta` (key/value), independent of `series`:
```ts
interface Meta {
  lastBackupAt: number; // epoch ms of last successful export; 0 = never
}
```
`db.ts` gains: `getMeta(): Promise<Meta>`, `setMeta(patch: Partial<Meta>): Promise<void>`.
The `meta` store is created in the SAME idb `upgrade` callback, bumping DB_VERSION 1 → 2.
The upgrade is additive and must not touch existing `series` data.

### Backfill
- `pinned` defaults to `false` for older IndexedDB records (App load) and older
  imports (deserialize via a boolean coercion helper).

---

## 2. Export / Import — envelope v2 with v1 compatibility

- Export envelope `version` bumped `1 → 2`. New records include `pinned`.
- `serialize` also stamps nothing new at the envelope level (lastBackupAt stays in
  `meta`, not exported — it's device-local).
- `deserialize` accepts **both** version 1 and version 2:
  - Reject only if `version` is neither 1 nor 2 (message names the version).
  - For v1 files, `pinned` is absent → defaults to `false`.
  - `originalTitle` handling unchanged.
- Add a `bool(v, default)` coercion helper (mirrors existing `str`/`num`).
- Tests: v2 round-trip incl. `pinned`; v1 file imports with `pinned=false`; unknown
  version rejected.

---

## 3. Import / Delete Undo

- **Delete undo:** on delete, keep the removed `Series` in memory; show a transient
  toast *"Deleted "<title>". Undo"* for ~6s. Undo re-`put`s it and restores UI order.
- **Replace-all undo:** before `clear()+bulkPut()`, snapshot the current `Series[]`
  in memory; toast *"Replaced N series. Undo"*; Undo does `clear()+bulkPut(snapshot)`
  and restores state.
- One lightweight `Toast` mechanism in `App` (single active toast, auto-dismiss,
  optional action button). No new dependency.

---

## 4. PWA (installable + offline)

- Add `vite-plugin-pwa` with `registerType: 'prompt'` and Workbox precache of the
  built assets + Google Font stylesheets/woff2 (runtime cache, StaleWhileRevalidate).
- `manifest.webmanifest`: name "Comic Tracker", short_name "Comics",
  `theme_color #0b0b0f`, `background_color #0b0b0f`, `display standalone`,
  `start_url` and `scope` derived from Vite `base` (see §5).
- **Icons (generated):** a vermilion book/ink glyph on `#0b0b0f`. Produce
  `pwa-192x192.png`, `pwa-512x512.png`, a maskable 512 variant, `apple-touch-icon.png`
  (180), and `favicon.svg` + `favicon.ico`. Source is a hand-authored SVG rasterized
  with `sharp` in a one-off `scripts/gen-icons.mjs` (dev-time only; committed PNGs).
- **Update prompt:** a small `PWAUpdatePrompt` component using
  `virtual:pwa-register/react`'s `useRegisterSW` → *"New version available — Reload"*.
- **Persistence request:** on app load, call `navigator.storage?.persist?.()` if
  available; store the boolean result in state and show a subtle indicator
  (persistent = quiet; non-persistent = a small hint in the backup area).

---

## 5. Deploy: GitHub Pages + CI

- **Vite base path:** `base: '/comic-tracker/'` (repo is `btd/comic-tracker`, served
  at `https://btd.github.io/comic-tracker/`). Set via `base` in `vite.config.ts`.
  `vite-plugin-pwa` reads this for manifest `scope`/`start_url` automatically.
- **Single GitHub Actions workflow** `.github/workflows/deploy.yml`:
  - Trigger: push to `master` (+ manual `workflow_dispatch`).
  - Job `build`: checkout → setup-node 20 → `npm ci` → `npm test` → `npm run build`
    → upload `dist/` as Pages artifact.
  - Job `deploy`: `actions/deploy-pages` with `pages: write` / `id-token: write`
    permissions and a `github-pages` environment. Depends on `build` (so a failing
    test blocks deploy — this is the CI gate too).
- SPA routing: app has no client-side routing, so no 404 fallback needed. (Documented,
  not implemented.)

---

## 6. UX

- **Pin/favorite:** star toggle (lucide `Star`/`StarOff`) on each card. Sorting always
  places `pinned` first, then applies the selected sort within each group.
- **Relative "updated" time:** e.g. "Updated 3d ago" / "today" on the card, computed
  from `updatedAt`. Pure helper `src/lib/relativeTime.ts`, unit-tested.
- **Keyboard:**
  - `Cmd/Ctrl+K` focuses the search box (global listener in App).
  - When a card has focus, `+`/`=` increments and `-` decrements that card's chapter.
    Cards get `tabIndex={0}` and a visible focus ring.
- **Quick-add:** a compact input in the toolbar; typing a title + Enter creates a
  Reading series immediately with defaults, then clears. Full Add modal remains.
- **Favicon + title:** real favicon (from §4 icons) wired in `index.html`; keeps
  existing `<title>Comic Tracker</title>`. Fixes the dev-only 404.

---

## 7. Cover Thumbnailing

- On file upload (in `SeriesFormModal`), downscale before storing: draw to a canvas
  at max width 400px (preserve aspect), export WebP (`toBlob`, quality ~0.82).
  Fall back to the original blob if canvas/WebP fails.
- Pure-ish helper `src/lib/thumbnail.ts` (takes a Blob, returns a Promise<Blob>).
- URL covers untouched. Reduces IndexedDB + export size substantially.

---

## 8. Testing

- Keep the 14 existing unit tests green; extend for new logic:
  - `exportImport.test.ts`: v2 round-trip w/ `pinned`; v1 import defaults; bad version.
  - `db.test.ts`: `meta` get/set; `series` store still works after v2 upgrade.
  - `relativeTime.test.ts`: today / Nd / weeks / months boundaries (inject `now`).
- **Component tests** (RTL + jsdom):
  - `SeriesCard`: clicking `+`/`-` fires the right callbacks; disabled `-` at 0.
  - `SeriesFormModal`: filling title + Save emits a Series with trimmed fields and
    `pinned` preserved; empty title shows the required error.
- Vitest config: add `@testing-library/jest-dom` to the existing `test-setup.ts`.

---

## 9. Docs

- **`CLAUDE.md`** at repo root: architecture (data flow, the db-only-in-App rule,
  pure modules), commands (`dev`/`build`/`test`), deploy model (Pages + base path),
  conventions (TS strict, no per-file React import, file-per-responsibility), and the
  "no backend / no scraping / sync deferred" constraints.

---

## Component / File Map (new & changed)

New:
- `src/lib/relativeTime.ts`, `src/lib/relativeTime.test.ts`
- `src/lib/thumbnail.ts`
- `src/components/Toast.tsx`
- `src/components/PWAUpdatePrompt.tsx`
- `src/components/SeriesCard.test.tsx`, `src/components/SeriesFormModal.test.tsx`
- `scripts/gen-icons.mjs`
- `public/` icons + `favicon.svg`/`favicon.ico`, generated `manifest` (by plugin)
- `.github/workflows/deploy.yml`
- `CLAUDE.md`

Changed:
- `src/types.ts` (+`pinned`, +`Meta`)
- `src/db.ts` (v2 upgrade, `meta` store, `getMeta`/`setMeta`)
- `src/exportImport.ts` (envelope v2, v1 compat, `bool` helper)
- `src/App.tsx` (persist request, backup nudge, toast/undo, pin sort, keyboard, quick-add, PWA prompt mount)
- `src/components/Toolbar.tsx` (quick-add input, search ref for Cmd+K)
- `src/components/SeriesCard.tsx` (pin star, relative time, keyboard, focusability)
- `src/components/SeriesFormModal.tsx` (thumbnail on upload, keep `pinned`)
- `src/App.css` / `src/index.css` (toast, star, focus ring, quick-add, nudge banner)
- `vite.config.ts` (`base`, PWA plugin)
- `index.html` (favicon links, apple-touch-icon)
- `package.json` (new deps, `gen-icons` script)

## Locked Defaults

- Backup nudge threshold: **7 days** (or never backed up).
- Thumbnail: **max 400px wide, WebP q≈0.82**.
- Undo window: **6 seconds**.
- PWA update: **prompt** (not auto-reload).

## Out of Scope (deferred / YAGNI)

- **Sync** (GitHub Gist / Dropbox / any remote) — separate future spec.
- Accounts/auth, in-app reading, tags/ratings, multiple lists, drag-reorder
  (pin covers the "bring to top" need for now).
