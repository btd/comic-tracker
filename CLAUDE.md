# Comic Tracker

Pure-browser (no backend) app to track manga/manhwa. Vite + React 19 + TypeScript,
data in IndexedDB, deployed to GitHub Pages.

## Commands
- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm test` — Vitest (unit + component)
- `npm run gen-icons` — regenerate PWA/favicon PNGs from `public/favicon.svg`

## Architecture
- `src/db.ts` — the ONLY module that talks to IndexedDB (via `idb`). Stores: `series`
  (keyed by id) and `meta` (key/value; `lastBackupAt`). DB is at version 2.
- `src/exportImport.ts` — PURE serialize/deserialize. No React/IDB imports. Export
  envelope is version 2; deserialize also accepts version 1 (backward compatible).
- `src/App.tsx` — owns in-memory `Series[]` and is the ONLY caller of `db`. Children
  receive data + callbacks.
- `src/lib/*` — pure helpers: `cover` (image src resolution + object URLs),
  `relativeTime`, `thumbnail` (canvas → WebP downscale on upload).
- `src/components/*` — Toolbar, SeriesGrid, SeriesCard, SeriesFormModal, ImportDialog,
  Toast, PWAUpdatePrompt.

## Conventions
- TypeScript strict; modern JSX transform (no per-file `import React`).
- One responsibility per file; keep files focused.
- Covers: URL string OR uploaded Blob (thumbnailed) stored in IndexedDB; exports inline
  covers as base64 data URLs so a backup file is self-contained.

## Deploy
- `base` is `/comic-tracker/` (served at https://btd.github.io/comic-tracker/).
- `.github/workflows/deploy.yml` runs test + build then deploys `dist/` to Pages on
  push to `master`. A failing test blocks the deploy.
- App has no client-side routing, so no SPA 404 fallback is needed.

## Constraints (deliberately out of scope)
- No backend, no cross-site image scraping (browser CORS), no accounts.
- Sync (remote backup) is deferred to a future spec; export/import is the transfer path.
