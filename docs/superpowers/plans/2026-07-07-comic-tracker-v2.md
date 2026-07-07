# Comic Tracker v2 (Hardening) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the v1 tracker with data-loss protection, PWA installability/offline, GitHub Pages + CI deploy, UX affordances (pin, relative time, keyboard, quick-add), cover thumbnailing, component tests, and docs.

**Architecture:** Still pure-browser, no backend. Add a `meta` key/value IndexedDB store (DB v2, additive upgrade) alongside `series`. Export envelope bumps to v2 while still importing v1. New pure helpers (`relativeTime`, `thumbnail`) and small UI pieces (`Toast`, `PWAUpdatePrompt`) keep `App` the single db caller and state owner. `vite-plugin-pwa` generates the service worker/manifest honoring Vite `base: '/comic-tracker/'`; one GitHub Actions workflow tests+builds+deploys to Pages.

**Tech Stack:** vite ^8.1.3, react ^19.2.7, typescript ^6.0.3, idb ^8.0.3, lucide-react ^1.23.0, vite-plugin-pwa ^1.3.0, workbox-window ^7.4.1, @testing-library/react ^16.3.2, @testing-library/jest-dom ^6.9.1, @testing-library/user-event ^14.6.1, sharp (dev, icon gen).

**Parallelizable leaf tasks** (no shared-file conflicts, can run concurrently any time after Task 1): Task 10 (icons), Task 11 (CI workflow), Task 14 (CLAUDE.md). Everything else is sequential because it touches shared core files (`types.ts`, `db.ts`, `exportImport.ts`, `App.tsx`, `SeriesCard.tsx`, `SeriesFormModal.tsx`).

---

## File Structure

New: `src/lib/relativeTime.ts`(+test), `src/lib/thumbnail.ts`, `src/components/Toast.tsx`, `src/components/PWAUpdatePrompt.tsx`, `src/components/SeriesCard.test.tsx`, `src/components/SeriesFormModal.test.tsx`, `scripts/gen-icons.mjs`, `.github/workflows/deploy.yml`, `CLAUDE.md`, `public/` icons.

Changed: `src/types.ts`, `src/db.ts`, `src/exportImport.ts`, `src/App.tsx`, `src/components/Toolbar.tsx`, `src/components/SeriesCard.tsx`, `src/components/SeriesFormModal.tsx`, `src/App.css`, `src/index.css`, `vite.config.ts`, `index.html`, `package.json`, `src/test-setup.ts`.

---

## Task 1: Install dependencies

**Files:** Modify `package.json` (via npm).

- [ ] **Step 1: Install runtime + dev deps**

Run:
```bash
npm install vite-plugin-pwa@^1.3.0 workbox-window@^7.4.1
npm install -D @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 @testing-library/user-event@^14.6.1 @testing-library/dom@^10 sharp
```
Expected: installs succeed, no peer-dependency errors that block (warnings OK).

- [ ] **Step 2: Verify build still green**

Run: `npm run build`
Expected: `tsc -b && vite build` succeed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add PWA, testing-library, and sharp dependencies"
```

---

## Task 2: Types — add `pinned` and `Meta`

**Files:** Modify `src/types.ts`.

- [ ] **Step 1: Add `pinned` to `Series` and new `Meta` type**

In `src/types.ts`, add `pinned: boolean;` to the `Series` interface (after `updatedAt`), and append:
```ts
export interface Meta {
  /** epoch ms of last successful export; 0 = never backed up */
  lastBackupAt: number;
}

export const DEFAULT_META: Meta = { lastBackupAt: 0 };
```
Also bump the export envelope version type:
```ts
export interface ExportEnvelope {
  app: 'comic-tracker';
  version: 2;
  exportedAt: number;
  series: SeriesExport[];
}
```
(`SeriesExport extends Omit<Series, 'coverBlob'>` already picks up `pinned` automatically.)

- [ ] **Step 2: Type-check (expected to FAIL until later tasks update callers)**

Run: `npx tsc -b 2>&1 | head -20`
Expected: errors about missing `pinned` in object literals across db.test.ts / exportImport.ts / SeriesFormModal.tsx. This is expected; subsequent tasks fix each. Do NOT fix them here.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add pinned field and Meta type (version bump to 2)"
```

---

## Task 3: db.ts — v2 upgrade, `meta` store, getMeta/setMeta

**Files:** Modify `src/db.ts`, `src/db.test.ts`.

- [ ] **Step 1: Update the failing test `src/db.test.ts`**

Add `pinned: false` to the `make()` helper's returned object (after `updatedAt: 1,`).
Then add this block inside `describe('db', ...)`:
```ts
  it('meta defaults then persists a patch', async () => {
    const { getMeta, setMeta } = await import('./db');
    // Fresh store: default meta
    expect((await getMeta()).lastBackupAt).toBe(0);
    await setMeta({ lastBackupAt: 12345 });
    expect((await getMeta()).lastBackupAt).toBe(12345);
  });

  it('series store still works after v2 upgrade', async () => {
    await put(make('z', { pinned: true }));
    expect((await get('z'))?.pinned).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL — `getMeta`/`setMeta` not exported.

- [ ] **Step 3: Implement v2 upgrade + meta accessors in `src/db.ts`**

Change the schema interface, version, and add a META store + accessors:
```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Meta, Series } from './types';
import { DEFAULT_META } from './types';

interface TrackerDB extends DBSchema {
  series: { key: string; value: Series };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'comic-tracker';
const DB_VERSION = 2;
const STORE = 'series';
const META_STORE = 'meta';
const META_KEY = 'app';
```
Update `getDB()`'s `upgrade` to create BOTH stores idempotently (runs for fresh installs at v2 and for v1→v2 upgrades):
```ts
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
```
Append accessors (keep all existing series functions unchanged):
```ts
export async function getMeta(): Promise<Meta> {
  const stored = (await (await getDB()).get(META_STORE, META_KEY)) as Partial<Meta> | undefined;
  return { ...DEFAULT_META, ...(stored ?? {}) };
}

export async function setMeta(patch: Partial<Meta>): Promise<void> {
  const next = { ...(await getMeta()), ...patch };
  await (await getDB()).put(META_STORE, next, META_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db.test.ts`
Expected: PASS (original 5 + 2 new = 7).

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src/db.test.ts
git commit -m "feat: add meta store and v2 IndexedDB upgrade"
```

---

## Task 4: exportImport.ts — envelope v2 with v1 compatibility

**Files:** Modify `src/exportImport.ts`, `src/exportImport.test.ts`.

- [ ] **Step 1: Update tests `src/exportImport.test.ts`**

Add `pinned: false` to the `make()` helper object (after `updatedAt: 2,`).
Then add:
```ts
  it('round-trips pinned in a v2 export', async () => {
    const json = await serialize([make({ pinned: true })]);
    expect(JSON.parse(json).version).toBe(2);
    const out = await deserialize(json);
    expect(out[0].pinned).toBe(true);
  });

  it('imports a v1 file and defaults pinned to false', async () => {
    const v1 = {
      app: 'comic-tracker', version: 1, exportedAt: 1,
      series: [{ id: 'a', title: 'Old', originalTitle: '', author: '' }],
    };
    const out = await deserialize(JSON.stringify(v1));
    expect(out[0].pinned).toBe(false);
    expect(out[0].title).toBe('Old');
  });
```
Update the existing "rejects unsupported version" test to use a clearly-unsupported version:
find the test using `version: 99` — leave it as is (99 is still rejected). Also update the
plain round-trip `toMatchObject` (from v1 plan) is fine; no change needed there.

- [ ] **Step 2: Run test to verify new ones fail**

Run: `npx vitest run src/exportImport.test.ts`
Expected: FAIL — version is still 1; v1 import path not yet accepting; `pinned` missing.

- [ ] **Step 3: Implement v2 in `src/exportImport.ts`**

Bump the constant and add a `bool` helper + `pinned` field + accept versions 1 and 2:
```ts
const VERSION = 2;
```
Add near the other coercion helpers:
```ts
function bool(v: unknown, dflt = false): boolean {
  return typeof v === 'boolean' ? v : dflt;
}
```
Change the version check in `deserialize` from strict-equality to a supported-set:
```ts
  if (env.version !== 1 && env.version !== 2) {
    throw new Error(`Import failed: unsupported export version ${String(env.version)}`);
  }
```
Add `pinned` to the constructed `Series` object (after `updatedAt`):
```ts
      pinned: bool(r.pinned),
```
`serialize` needs no logic change — `pinned` is a plain field already spread via `...rest`,
and `VERSION` now stamps 2.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/exportImport.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/exportImport.ts src/exportImport.test.ts
git commit -m "feat: export envelope v2 with pinned, still imports v1"
```

---

## Task 5: relativeTime helper

**Files:** Create `src/lib/relativeTime.ts`, `src/lib/relativeTime.test.ts`.

- [ ] **Step 1: Write the failing test `src/lib/relativeTime.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const DAY = 86_400_000;
const now = 1_000 * DAY; // arbitrary fixed "now"

describe('relativeTime', () => {
  it('shows "today" for the same day', () => {
    expect(relativeTime(now, now)).toBe('today');
    expect(relativeTime(now - 3600_000, now)).toBe('today');
  });
  it('shows yesterday and N days', () => {
    expect(relativeTime(now - DAY, now)).toBe('yesterday');
    expect(relativeTime(now - 5 * DAY, now)).toBe('5d ago');
  });
  it('shows weeks and months', () => {
    expect(relativeTime(now - 14 * DAY, now)).toBe('2w ago');
    expect(relativeTime(now - 70 * DAY, now)).toBe('2mo ago');
  });
  it('guards against future timestamps', () => {
    expect(relativeTime(now + DAY, now)).toBe('today');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/relativeTime.test.ts`
Expected: FAIL — cannot resolve `./relativeTime`.

- [ ] **Step 3: Implement `src/lib/relativeTime.ts`**

```ts
const DAY = 86_400_000;

/** Compact relative time from `then` to `now` (both epoch ms). */
export function relativeTime(then: number, now: number = Date.now()): string {
  const diff = now - then;
  if (diff < DAY && diff >= 0) return 'today';
  if (diff < 0) return 'today'; // future guard
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/relativeTime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relativeTime.ts src/lib/relativeTime.test.ts
git commit -m "feat: add relativeTime helper"
```

---

## Task 6: thumbnail helper

**Files:** Create `src/lib/thumbnail.ts`.

- [ ] **Step 1: Implement `src/lib/thumbnail.ts`**

```ts
/**
 * Downscale an image blob to at most `maxWidth` px wide and re-encode as WebP.
 * Returns the original blob unchanged if it isn't an image or if canvas/WebP fails.
 */
export async function makeThumbnail(
  blob: Blob,
  maxWidth = 400,
  quality = 0.82,
): Promise<Blob> {
  if (!blob.type.startsWith('image/')) return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors (note: earlier tasks must have resolved `pinned` errors; if `tsc -b` still reports `pinned` errors from Task 2, that's fine to defer until Task 8 — verify no NEW errors originate from thumbnail.ts).

- [ ] **Step 3: Commit**

```bash
git add src/lib/thumbnail.ts
git commit -m "feat: add cover thumbnail helper (canvas -> webp)"
```

---

## Task 7: Toast component

**Files:** Create `src/components/Toast.tsx`.

- [ ] **Step 1: Implement `src/components/Toast.tsx`**

```tsx
import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ toast, onDismiss, duration = 6000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button
          className="toast-action"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b 2>&1 | grep -i toast || echo "no toast errors"`
Expected: no errors referencing Toast.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add Toast component with action + auto-dismiss"
```

---

## Task 8: SeriesFormModal — thumbnail on upload, keep pinned

**Files:** Modify `src/components/SeriesFormModal.tsx`.

- [ ] **Step 1: Import thumbnail helper**

Add near the top imports:
```tsx
import { makeThumbnail } from '../lib/thumbnail';
```

- [ ] **Step 2: Thumbnail the uploaded file**

Replace the file input's onChange (currently `onChange={(e) => setCoverBlob(e.target.files?.[0] ?? coverBlob)}`) with an async handler that downscales:
```tsx
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setCoverBlob(await makeThumbnail(file));
              }}
```

- [ ] **Step 3: Preserve `pinned` in the saved object**

In `handleSave`'s `onSave({...})` object, add (after `updatedAt: now,`):
```tsx
      pinned: initial?.pinned ?? false,
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc -b`
Expected: no errors (the `pinned` literal error from Task 2 for this file is now resolved).

- [ ] **Step 5: Commit**

```bash
git add src/components/SeriesFormModal.tsx
git commit -m "feat: thumbnail uploaded covers and preserve pinned in form"
```

---

## Task 9: SeriesCard — pin star, relative time, keyboard, focusability

**Files:** Modify `src/components/SeriesCard.tsx`.

- [ ] **Step 1: Extend props and imports**

Add to imports:
```tsx
import { Plus, Minus, Pencil, Trash2, ExternalLink, Star } from 'lucide-react';
import { relativeTime } from '../lib/relativeTime';
```
Add `onTogglePin: (id: string) => void;` to the `Props` interface.
Destructure it in the component signature.

- [ ] **Step 2: Make the card focusable and keyboard-driven**

Change the root `<div className="card">` to:
```tsx
    <div
      className="card"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); onIncrement(series.id); }
        else if (e.key === '-') { e.preventDefault(); onDecrement(series.id); }
      }}
    >
```

- [ ] **Step 3: Add the pin star to the cover actions**

In the `.cover-actions` div, add as the FIRST button (before Edit):
```tsx
          <button
            className={`icon-btn${series.pinned ? ' pinned' : ''}`}
            aria-label={series.pinned ? 'Unpin series' : 'Pin series'}
            aria-pressed={series.pinned}
            onClick={() => onTogglePin(series.id)}
          >
            <Star size={15} fill={series.pinned ? 'currentColor' : 'none'} />
          </button>
```

- [ ] **Step 4: Show relative updated time**

After the `.card-meta` div, add:
```tsx
        <div className="card-updated">Updated {relativeTime(series.updatedAt)}</div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/SeriesCard.tsx
git commit -m "feat: pin star, relative updated time, keyboard chapter control"
```

---

## Task 10: Generate app icons  [PARALLELIZABLE]

**Files:** Create `scripts/gen-icons.mjs`, `public/favicon.svg`, generated PNGs in `public/`. Modify `package.json` (script).

- [ ] **Step 1: Create the source SVG `public/favicon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b0b0f"/>
  <g transform="translate(140 120)">
    <rect x="0" y="0" width="150" height="272" rx="14" fill="#ff4d3d"/>
    <rect x="70" y="0" width="150" height="272" rx="14" fill="#ff6a5c"/>
    <rect x="103" y="26" width="14" height="220" rx="7" fill="#0b0b0f" opacity="0.55"/>
  </g>
</svg>
```

- [ ] **Step 2: Create `scripts/gen-icons.mjs`**

```js
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const svg = readFileSync(join(pub, 'favicon.svg'));

const targets = [
  ['pwa-192x192.png', 192, false],
  ['pwa-512x512.png', 512, false],
  ['maskable-512x512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-48x48.png', 48, false],
];

for (const [name, size, maskable] of targets) {
  let img = sharp(svg).resize(size, size);
  if (maskable) {
    // Maskable needs safe padding: place the glyph at 80% on a solid bg.
    const inner = Math.round(size * 0.8);
    img = sharp({
      create: { width: size, height: size, channels: 4, background: '#0b0b0f' },
    }).composite([{ input: await sharp(svg).resize(inner, inner).png().toBuffer() }]);
  }
  await img.png().toFile(join(pub, name));
  console.log('wrote', name);
}
console.log('done');
```

- [ ] **Step 3: Add script to `package.json`**

Add to `"scripts"`: `"gen-icons": "node scripts/gen-icons.mjs"`.

- [ ] **Step 4: Generate icons**

Run: `npm run gen-icons`
Expected: prints "wrote ..." for each and "done"; PNGs exist in `public/`.

- [ ] **Step 5: Verify files**

Run: `ls -1 public/`
Expected: favicon.svg + the 5 PNGs present.

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-icons.mjs public/ package.json
git commit -m "feat: generate app + favicon icons from svg"
```

---

## Task 11: GitHub Actions Pages deploy + CI  [PARALLELIZABLE]

**Files:** Create `.github/workflows/deploy.yml`.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate YAML syntax**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/deploy.yml','utf8'); if(!y.includes('deploy-pages')) throw new Error('missing'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build+test+deploy to GitHub Pages on push to master"
```

---

## Task 12: Vite config — base path + PWA plugin

**Files:** Modify `vite.config.ts`.

- [ ] **Step 1: Rewrite `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/comic-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Comic Tracker',
        short_name: 'Comics',
        description: 'Track the manga and manhwa you are reading.',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 2: Build to verify PWA emits SW + manifest**

Run: `npm run build`
Expected: build succeeds; output lists `dist/sw.js` and `dist/manifest.webmanifest` (plus `workbox-*.js`).

- [ ] **Step 3: Verify base path applied**

Run: `grep -o '/comic-tracker/[^" ]*' dist/index.html | head -3`
Expected: asset URLs are prefixed with `/comic-tracker/`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat: set Pages base path and add vite-plugin-pwa"
```

---

## Task 13: index.html — favicon + apple-touch-icon links

**Files:** Modify `index.html`.

- [ ] **Step 1: Add icon links in `<head>`**

After the existing `<meta name="theme-color" ...>` line, add:
```html
    <link rel="icon" href="/comic-tracker/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/comic-tracker/apple-touch-icon.png" />
```
(Absolute base-prefixed paths so they resolve on Pages. Dev server also serves under root; if the dev-only favicon 404 persists it is harmless — production Pages is the target.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wire favicon and apple-touch-icon"
```

---

## Task 14: CLAUDE.md  [PARALLELIZABLE]

**Files:** Create `CLAUDE.md`.

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md"
```

---

## Task 15: App wiring — persist, backup nudge, toast/undo, pin sort, keyboard, quick-add, PWA prompt

**Files:** Modify `src/App.tsx`, `src/components/Toolbar.tsx`, `src/components/PWAUpdatePrompt.tsx` (create), `src/App.css`, `src/index.css`.

- [ ] **Step 1: Create `src/components/PWAUpdatePrompt.tsx`**

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="pwa-toast" role="alert">
      <span>New version available.</span>
      <button className="toast-action" onClick={() => updateServiceWorker(true)}>Reload</button>
      <button className="toast-close" aria-label="Dismiss" onClick={() => setNeedRefresh(false)}>×</button>
    </div>
  );
}
```

- [ ] **Step 2: Add PWA virtual-module types to `src/vite-env.d.ts`**

Append:
```ts
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 3: Update `Toolbar.tsx` — quick-add input + search ref**

Add to `Props`: `onQuickAdd: (title: string) => void;` and `searchRef: React.RefObject<HTMLInputElement | null>;`.
Import `useState` and `type React` as needed (`import { useState } from 'react';`).
Attach the ref to the search `<input ref={p.searchRef} .../>`.
Add, right after the search box, a quick-add form:
```tsx
      <QuickAdd onQuickAdd={p.onQuickAdd} />
```
And define at the bottom of the file (above default export or below—either, but include it):
```tsx
function QuickAdd({ onQuickAdd }: { onQuickAdd: (t: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        const t = value.trim();
        if (!t) return;
        onQuickAdd(t);
        setValue('');
      }}
    >
      <input
        placeholder="Quick add title…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
```

- [ ] **Step 4: Update `src/App.tsx`**

Add imports:
```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db';
import { serialize } from './exportImport';
import type { Series } from './types';
import Toolbar, { type SortKey, type StatusFilter } from './components/Toolbar';
import SeriesGrid from './components/SeriesGrid';
import SeriesFormModal from './components/SeriesFormModal';
import ImportDialog from './components/ImportDialog';
import Toast, { type ToastState } from './components/Toast';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { relativeTime } from './lib/relativeTime';
import './App.css';
```
Add state (with existing ones):
```tsx
  const [toast, setToast] = useState<ToastState | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
```
Replace the mount effect to also request persistence + load meta:
```tsx
  useEffect(() => {
    reload().catch(() => setError('Failed to load your data.'));
    db.getMeta().then((m) => setLastBackupAt(m.lastBackupAt)).catch(() => {});
    navigator.storage?.persist?.().then((p) => setPersistent(p)).catch(() => {});
  }, []);
```
Add a global Cmd/Ctrl+K listener:
```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```
Add pin toggle:
```tsx
  function togglePin(id: string) {
    const found = series.find((s) => s.id === id);
    if (!found) return;
    void persist({ ...found, pinned: !found.pinned, updatedAt: Date.now() });
  }
```
Add quick-add:
```tsx
  function quickAdd(title: string) {
    const now = Date.now();
    void persist({
      id: crypto.randomUUID(),
      title,
      originalTitle: '',
      author: '',
      link: '',
      linkLabel: '',
      lastChapter: 0,
      status: 'reading',
      coverType: 'none',
      coverUrl: '',
      createdAt: now,
      updatedAt: now,
      pinned: false,
    });
  }
```
Update `handleExport` to stamp lastBackupAt after a successful download:
```tsx
  async function handleExport() {
    const json = await serialize(series);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comic-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const now = Date.now();
    setLastBackupAt(now);
    await db.setMeta({ lastBackupAt: now }).catch(() => {});
  }
```
Update `handleDelete` to offer undo (replace the existing function body):
```tsx
  async function handleDelete(target: Series) {
    if (!confirm(`Delete "${target.title}"?`)) return;
    setSeries((prev) => prev.filter((s) => s.id !== target.id));
    try {
      await db.remove(target.id);
      setToast({
        message: `Deleted "${target.title}".`,
        actionLabel: 'Undo',
        onAction: () => void persist(target),
      });
    } catch {
      setError('Failed to delete.');
      await reload().catch(() => {});
    }
  }
```
Update `handleImport` to snapshot + offer undo on replace (replace existing function):
```tsx
  async function handleImport(imported: Series[], mode: 'merge' | 'replace') {
    const snapshot = series;
    try {
      if (mode === 'replace') {
        await db.clear();
        await db.bulkPut(imported);
        setSeries(imported);
        setToast({
          message: `Replaced with ${imported.length} series.`,
          actionLabel: 'Undo',
          onAction: () => {
            void (async () => {
              await db.clear();
              await db.bulkPut(snapshot);
              setSeries(snapshot);
            })();
          },
        });
      } else {
        await db.bulkPut(imported);
        setSeries((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          imported.forEach((s) => map.set(s.id, s));
          return [...map.values()];
        });
      }
      setImporting(false);
    } catch {
      setError('Failed to import.');
      await reload().catch(() => {});
    }
  }
```
Update the `visible` memo to sort pinned-first:
```tsx
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = series.filter(
      (s) =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (q === '' ||
          s.title.toLowerCase().includes(q) ||
          s.originalTitle.toLowerCase().includes(q)),
    );
    const sorted = [...filtered];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'chapter') sorted.sort((a, b) => b.lastChapter - a.lastChapter);
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned)); // stable: pinned first
    return sorted;
  }, [series, search, statusFilter, sort]);
```
Compute the backup nudge (before `return`):
```tsx
  const backupStale =
    series.length > 0 && (lastBackupAt === 0 || Date.now() - lastBackupAt > 7 * 86_400_000);
```
Update the JSX: pass new props to Toolbar, add the nudge banner, wire SeriesCard's
`onTogglePin`, and mount Toast + PWA prompt. Replace the returned JSX with:
```tsx
  return (
    <div className="app">
      <Toolbar
        search={search} statusFilter={statusFilter} sort={sort}
        onSearch={setSearch} onStatusFilter={setStatusFilter} onSort={setSort}
        onAdd={() => setEditing(null)} onExport={handleExport} onImport={() => setImporting(true)}
        onQuickAdd={quickAdd} searchRef={searchRef}
      />
      {error && <div className="error-banner" onClick={() => setError('')}>{error} (click to dismiss)</div>}
      {backupStale && (
        <div className="nudge-banner">
          <span>
            {lastBackupAt === 0
              ? 'You have never backed up your list.'
              : `Last backup ${relativeTime(lastBackupAt)}.`}
            {persistent === false && ' Browser storage is not marked persistent — export to be safe.'}
          </span>
          <button className="toast-action" onClick={handleExport}>Export now</button>
        </div>
      )}
      <SeriesGrid
        series={visible} totalCount={series.length}
        onIncrement={(id) => changeChapter(id, 1)}
        onDecrement={(id) => changeChapter(id, -1)}
        onEdit={(s) => setEditing(s)}
        onDelete={handleDelete}
        onTogglePin={togglePin}
      />
      {editing !== undefined && (
        <SeriesFormModal
          initial={editing}
          onSave={(s) => { void persist(s); setEditing(undefined); }}
          onClose={() => setEditing(undefined)}
        />
      )}
      {importing && (
        <ImportDialog onImport={handleImport} onClose={() => setImporting(false)} />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <PWAUpdatePrompt />
    </div>
  );
```
Also ensure the mount `reload()` backfills `pinned` (update the map in `reload`):
```tsx
  async function reload() {
    const list = await db.getAll();
    setSeries(list.map((s) => ({ ...s, originalTitle: s.originalTitle ?? '', pinned: s.pinned ?? false })));
  }
```

- [ ] **Step 5: Update `SeriesGrid.tsx` to pass `onTogglePin` through**

Add `onTogglePin: (id: string) => void;` to `SeriesGrid`'s `Props`. It already spreads
`...handlers` to `SeriesCard`, so add `onTogglePin` to the destructured handlers by
NOT destructuring it out — i.e., keep `{ series, totalCount, ...handlers }` and ensure
`onTogglePin` is part of `handlers`. Since `handlers` is spread from remaining props,
just adding it to the `Props` interface is sufficient; verify SeriesCard receives it.

- [ ] **Step 6: Add CSS for toast, nudge, star, quick-add, focus ring, updated time**

Append to `src/App.css`:
```css
/* Pinned star */
.icon-btn.pinned { color: var(--warn); border-color: var(--warn); }

/* Relative updated time */
.card-updated { font-size: 11px; color: var(--text-faint); }

/* Quick add */
.quick-add { flex: 1 1 160px; max-width: 220px; }
.quick-add input {
  width: 100%; font-family: inherit; font-size: 14px; color: var(--text);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 999px; padding: 9px 15px;
}
.quick-add input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

/* Card keyboard focus */
.card:focus-visible { outline: 2px solid var(--accent-hi); outline-offset: 3px; }

/* Nudge banner */
.nudge-banner {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: rgba(255, 179, 64, 0.12); border: 1px solid rgba(255, 179, 64, 0.4);
  color: #ffd79a; padding: 11px 15px; border-radius: 12px; margin-bottom: 18px; font-size: 14px;
}

/* Toasts (Toast component + PWA prompt) */
.toast, .pwa-toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; z-index: 60;
  background: var(--surface-2); color: var(--text);
  border: 1px solid var(--border-strong); border-radius: 12px;
  padding: 10px 12px 10px 16px; box-shadow: var(--shadow-lift);
  animation: modal-in 0.28s var(--ease);
}
.pwa-toast { bottom: 76px; }
.toast-action {
  background: var(--accent); color: #fff; border: none;
  border-radius: 8px; padding: 6px 12px; font-weight: 600;
}
.toast-close {
  background: transparent; border: none; color: var(--text-dim);
  display: inline-flex; padding: 4px; border-radius: 6px; font-size: 16px; line-height: 1;
}
.toast-close:hover { color: var(--text); background: var(--surface-hover); }
```

- [ ] **Step 7: Full build + tests**

Run: `npm run build && npm test`
Expected: `tsc -b` clean, `vite build` emits SW + manifest, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx src/components/PWAUpdatePrompt.tsx src/components/SeriesGrid.tsx src/vite-env.d.ts src/App.css
git commit -m "feat: persistence request, backup nudge, undo toasts, pin sort, keyboard, quick-add, PWA prompt"
```

---

## Task 16: test-setup — jest-dom matchers

**Files:** Modify `src/test-setup.ts`.

- [ ] **Step 1: Add jest-dom import at the top of `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```
(Keep the existing Blob polyfill code below it.)

- [ ] **Step 2: Run tests to confirm setup loads**

Run: `npx vitest run`
Expected: existing tests still pass (matchers now available).

- [ ] **Step 3: Commit**

```bash
git add src/test-setup.ts
git commit -m "test: register jest-dom matchers"
```

---

## Task 17: Component tests

**Files:** Create `src/components/SeriesCard.test.tsx`, `src/components/SeriesFormModal.test.tsx`.

- [ ] **Step 1: Write `src/components/SeriesCard.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesCard from './SeriesCard';
import type { Series } from '../types';

function make(over: Partial<Series> = {}): Series {
  return {
    id: 'a', title: 'Test', originalTitle: '', author: '', link: '', linkLabel: '',
    lastChapter: 3, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: Date.now(), pinned: false, ...over,
  };
}

const handlers = () => ({
  onIncrement: vi.fn(), onDecrement: vi.fn(), onEdit: vi.fn(),
  onDelete: vi.fn(), onTogglePin: vi.fn(),
});

describe('SeriesCard', () => {
  it('fires onIncrement when + is clicked', async () => {
    const h = handlers();
    render(<SeriesCard series={make()} {...h} />);
    await userEvent.click(screen.getByLabelText('Increment chapter'));
    expect(h.onIncrement).toHaveBeenCalledWith('a');
  });

  it('disables decrement at chapter 0', () => {
    const h = handlers();
    render(<SeriesCard series={make({ lastChapter: 0 })} {...h} />);
    expect(screen.getByLabelText('Decrement chapter')).toBeDisabled();
  });

  it('fires onTogglePin from the star', async () => {
    const h = handlers();
    render(<SeriesCard series={make()} {...h} />);
    await userEvent.click(screen.getByLabelText('Pin series'));
    expect(h.onTogglePin).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Write `src/components/SeriesFormModal.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesFormModal from './SeriesFormModal';

describe('SeriesFormModal', () => {
  it('requires a title', async () => {
    const onSave = vi.fn();
    render(<SeriesFormModal initial={null} onSave={onSave} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('saves a trimmed title with pinned defaulting to false', async () => {
    const onSave = vi.fn();
    render(<SeriesFormModal initial={null} onSave={onSave} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Title*'), '  Berserk  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.title).toBe('Berserk');
    expect(saved.pinned).toBe(false);
  });
});
```

- [ ] **Step 3: Run component tests**

Run: `npx vitest run src/components`
Expected: PASS (5 tests). If a label query fails, inspect the rendered output and align
the query to the actual `aria-label`/label text — do NOT change component behavior to
satisfy a bad query.

- [ ] **Step 4: Full suite**

Run: `npm test`
Expected: all unit + component tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SeriesCard.test.tsx src/components/SeriesFormModal.test.tsx
git commit -m "test: add SeriesCard and SeriesFormModal component tests"
```

---

## Task 18: Responsive / mobile layout

**Files:** Modify `src/App.css`.

Goal: comfortable layout on the three explicit target devices — **Pixel 6** (412×915
CSS px, portrait phone), **iPad 10th gen / 10.9"** (820×1180 portrait, 1180 landscape),
and **desktop** (existing `max-width: 1240px` layout). CSS-only — no component/logic
changes. Breakpoints are chosen around these widths: phone `≤600px` (covers Pixel 6
412px), tablet `601–1024px` (covers iPad portrait 820px and landscape 1180px sits just
above, using the roomy desktop grid), desktop `>1024px` unchanged.

- [ ] **Step 1: Append responsive rules to `src/App.css`**

```css
/* ---------- Responsive ---------- */

/* Phone — Pixel 6 (412px) and similar, up to 600px */
@media (max-width: 600px) {
  .app { padding: 0 12px 64px; }

  /* Toolbar reflows: title on its own row, then search, quick-add, filters, actions */
  .toolbar { gap: 8px; padding: 12px 0; }
  .app-title { flex: 1 1 100%; font-size: 22px; }
  .search-box { flex: 1 1 100%; max-width: none; order: 1; }
  .quick-add { flex: 1 1 100%; max-width: none; order: 2; }
  .toolbar select { order: 3; flex: 1 1 46%; }
  .spacer { display: none; }
  .toolbar > .primary-btn,
  .toolbar > .text-btn { order: 4; flex: 1 1 30%; justify-content: center; }

  /* 2-column grid on phones (Pixel 6 fits two ~185px cards comfortably) */
  .grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .card-title { font-size: 15px; }

  /* Toasts span width instead of a centered pill */
  .toast, .pwa-toast {
    left: 12px; right: 12px; transform: none; bottom: 16px;
    justify-content: space-between;
  }
  .pwa-toast { bottom: 84px; }

  /* Modal fills more of the screen */
  .modal { max-width: none; }
}

/* Tablet — iPad 10.9" portrait (820px). Keep the auto-fill grid but a touch denser. */
@media (min-width: 601px) and (max-width: 1024px) {
  .grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
}

/* Touch devices (Pixel 6, iPad): cover actions always visible — there's no hover. */
@media (hover: none) {
  .cover-actions { opacity: 1; transform: none; }
}

/* Coarse pointers: larger tap targets */
@media (pointer: coarse) {
  .icon-btn { padding: 10px; }
  .card-chapter .icon-btn { padding: 10px 12px; }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Verify at each target viewport in a browser**

Run: `npm run preview`, then in the browser device toolbar check all three:
- **Pixel 6 (412×915):** toolbar controls stack without overflow; grid shows 2 columns;
  pin/edit/delete visible without hover; toast spans width; modal comfortable. No
  horizontal scroll.
- **iPad (820×1180):** multi-column grid (~4 cols), toolbar on one/two rows, cover
  actions visible on tap. No horizontal scroll.
- **Desktop (≥1240px):** unchanged from before (hover reveals cover actions).

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat: responsive layout for phones and touch devices"
```

---

## Task 19: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Clean build + full test**

Run: `npm run build && npm test`
Expected: build emits `dist/sw.js` + `dist/manifest.webmanifest`; all tests pass.

- [ ] **Step 2: Preview the production build and smoke-test in a browser**

Run: `npm run preview` (serves at the base path). Verify in a browser:
- App loads under `/comic-tracker/`.
- Quick-add creates a Reading entry; pin toggles and moves the card to the front.
- Increment via `+` and via keyboard (focus a card, press `+`).
- `Cmd/Ctrl+K` focuses search.
- Export downloads JSON and clears the nudge; re-import (v2) works; a hand-made v1 file imports.
- DevTools → Application: a service worker is registered and a manifest is present.
- Toggle the device toolbar to a phone width (~375px): responsive layout holds, no
  horizontal scroll, cover actions visible without hover.

- [ ] **Step 3: (No commit — verification only. Fix-forward if issues found.)**

---

## Self-Review Notes

- **Spec coverage:** §1 data model (T2/T3), §2 export v2+v1 (T4), §3 undo toasts (T7/T15),
  §4 PWA incl. icons/update/persist (T10/T12/T13/T15), §5 Pages+CI+base (T11/T12), §6 UX
  pin/relative/keyboard/quick-add/favicon (T5/T9/T13/T15), §7 thumbnail (T6/T8), §8 tests
  (T3/T4/T5/T16/T17), §9 CLAUDE.md (T14), responsive/mobile (T18). All covered.
- **Type consistency:** `pinned: boolean` and `Meta.lastBackupAt` defined in T2 and used
  identically in T3/T4/T8/T9/T15/T17. `getMeta`/`setMeta`, `makeThumbnail`, `relativeTime`,
  `ToastState`, `onTogglePin`, `onQuickAdd`, `searchRef` names consistent across tasks.
- **No placeholders:** every code step is complete.
- **Ordering note:** T2 intentionally leaves the tree not-type-clean; T3/T4/T8/T9/T15
  progressively resolve all `pinned` literal errors. The first task that runs a full green
  `tsc -b` end-to-end is T15 (and verified again in T18).
