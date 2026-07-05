# Comic Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-browser Vite + React + TypeScript app to track manga/manhwa, with local IndexedDB persistence and self-contained JSON export/import.

**Architecture:** Single-page React app. `App` owns the in-memory `Series[]` and is the only component that talks to `db.ts` (an `idb` wrapper over one IndexedDB object store). `exportImport.ts` is a pure serialize/deserialize module (blob ↔ base64) with no React/IDB dependency. UI is composed of a `Toolbar`, a `SeriesGrid` of `SeriesCard`s, a `SeriesFormModal`, and an `ImportDialog`. Icons from `lucide-react`.

**Tech Stack:** vite ^8.1.3, react/react-dom ^19.2.7, @vitejs/plugin-react ^6.0.3, typescript ^6.0.3, vitest ^4.1.9, idb ^8.0.3, lucide-react ^1.23.0, fake-indexeddb (dev, for tests).

---

## File Structure

- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html` — scaffold.
- `src/main.tsx` — React entry.
- `src/types.ts` — `Series`, `Status`, `CoverType`, export envelope types.
- `src/db.ts` — IndexedDB CRUD via `idb`. Only persistence module.
- `src/exportImport.ts` — pure serialize/deserialize + blob↔base64.
- `src/App.tsx` — state owner, wiring, error banner.
- `src/components/Toolbar.tsx` — search/filter/sort/add/export/import controls.
- `src/components/SeriesGrid.tsx` — grid + empty state.
- `src/components/SeriesCard.tsx` — one card, increment/decrement/edit/delete.
- `src/components/SeriesFormModal.tsx` — add/edit form.
- `src/components/ImportDialog.tsx` — import file picker + merge/replace.
- `src/lib/cover.ts` — helper to resolve a `Series` to a display image src (object URL / url / placeholder).
- `src/App.css`, `src/index.css` — minimal styling.
- Tests: `src/db.test.ts`, `src/exportImport.test.ts`.

---

## Task 1: Scaffold project and dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "comic-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "idb": "^8.0.3",
    "lucide-react": "^1.23.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.3",
    "fake-indexeddb": "^6",
    "jsdom": "^25",
    "typescript": "^6.0.3",
    "vite": "^8.1.3",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`** (also configures Vitest)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Comic Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create placeholder `src/App.tsx`**

```tsx
export default function App() {
  return <h1>Comic Tracker</h1>;
}
```

- [ ] **Step 8: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Create minimal `src/index.css`**

```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; }
```

- [ ] **Step 10: Install and verify build**

Run: `npm install && npm run build`
Expected: install succeeds; `tsc -b && vite build` completes with a `dist/` folder, no type errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + ts project"
```

---

## Task 2: Types and database module

**Files:**
- Create: `src/types.ts`, `src/db.ts`
- Test: `src/db.test.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type Status = 'reading' | 'completed' | 'on-hold' | 'dropped';
export type CoverType = 'url' | 'file' | 'none';

export interface Series {
  id: string;
  title: string;
  author: string;
  link: string;
  linkLabel: string;
  lastChapter: number;
  status: Status;
  coverType: CoverType;
  coverUrl: string;
  coverBlob?: Blob;
  createdAt: number;
  updatedAt: number;
}

export const STATUSES: Status[] = ['reading', 'completed', 'on-hold', 'dropped'];

/** A Series as it appears in an export file: blob replaced by a base64 data URL. */
export interface SeriesExport extends Omit<Series, 'coverBlob'> {
  coverDataUrl?: string;
}

export interface ExportEnvelope {
  app: 'comic-tracker';
  version: 1;
  exportedAt: number;
  series: SeriesExport[];
}
```

- [ ] **Step 2: Write the failing test `src/db.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getAll, get, put, remove, bulkPut, clear } from './db';
import type { Series } from './types';

function make(id: string, over: Partial<Series> = {}): Series {
  return {
    id, title: `T${id}`, author: '', link: '', linkLabel: '',
    lastChapter: 0, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: 1, ...over,
  };
}

describe('db', () => {
  beforeEach(async () => { await clear(); });

  it('put then getAll returns the record', async () => {
    await put(make('a'));
    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a');
  });

  it('get returns one record or undefined', async () => {
    await put(make('a'));
    expect((await get('a'))?.id).toBe('a');
    expect(await get('missing')).toBeUndefined();
  });

  it('put updates an existing record', async () => {
    await put(make('a', { lastChapter: 1 }));
    await put(make('a', { lastChapter: 5 }));
    expect((await get('a'))?.lastChapter).toBe(5);
    expect(await getAll()).toHaveLength(1);
  });

  it('remove deletes a record', async () => {
    await put(make('a'));
    await remove('a');
    expect(await getAll()).toHaveLength(0);
  });

  it('bulkPut inserts many; clear empties store', async () => {
    await bulkPut([make('a'), make('b')]);
    expect(await getAll()).toHaveLength(2);
    await clear();
    expect(await getAll()).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL — cannot resolve `./db` / functions not defined.

- [ ] **Step 4: Implement `src/db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Series } from './types';

interface TrackerDB extends DBSchema {
  series: { key: string; value: Series };
}

const DB_NAME = 'comic-tracker';
const DB_VERSION = 1;
const STORE = 'series';

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll(): Promise<Series[]> {
  return (await getDB()).getAll(STORE);
}

export async function get(id: string): Promise<Series | undefined> {
  return (await getDB()).get(STORE, id);
}

export async function put(series: Series): Promise<void> {
  await (await getDB()).put(STORE, series);
}

export async function remove(id: string): Promise<void> {
  await (await getDB()).delete(STORE, id);
}

export async function bulkPut(list: Series[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all([...list.map((s) => tx.store.put(s)), tx.done]);
}

export async function clear(): Promise<void> {
  await (await getDB()).clear(STORE);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/db.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/db.ts src/db.test.ts
git commit -m "feat: add types and IndexedDB persistence module"
```

---

## Task 3: Export / Import module

**Files:**
- Create: `src/exportImport.ts`
- Test: `src/exportImport.test.ts`

- [ ] **Step 1: Write the failing test `src/exportImport.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { serialize, deserialize } from './exportImport';
import type { Series } from './types';

function make(over: Partial<Series> = {}): Series {
  return {
    id: 'a', title: 'Solo Leveling', author: 'Chugong', link: '', linkLabel: '',
    lastChapter: 12, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: 2, ...over,
  };
}

describe('exportImport', () => {
  it('round-trips a plain series through serialize/deserialize', async () => {
    const out = await deserialize(await serialize([make()]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', title: 'Solo Leveling', lastChapter: 12 });
  });

  it('round-trips a file cover as blob -> base64 -> blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const json = await serialize([make({ coverType: 'file', coverBlob: blob })]);
    expect(json).not.toContain('[object Blob]');
    expect(json).toContain('coverDataUrl');
    const out = await deserialize(json);
    expect(out[0].coverType).toBe('file');
    expect(out[0].coverBlob).toBeInstanceOf(Blob);
    expect(await out[0].coverBlob!.text()).toBe('hello');
  });

  it('ignores unknown extra fields (forward compatible)', async () => {
    const env = JSON.parse(await serialize([make()]));
    env.series[0].somethingNew = 42;
    const out = await deserialize(JSON.stringify(env));
    expect(out[0].id).toBe('a');
  });

  it('rejects wrong app', async () => {
    await expect(deserialize(JSON.stringify({ app: 'nope', version: 1, series: [] })))
      .rejects.toThrow(/not a comic-tracker/i);
  });

  it('rejects unsupported version', async () => {
    await expect(deserialize(JSON.stringify({ app: 'comic-tracker', version: 99, series: [] })))
      .rejects.toThrow(/version/i);
  });

  it('rejects malformed json', async () => {
    await expect(deserialize('{not json')).rejects.toThrow();
  });

  it('rejects a record missing a title', async () => {
    const env = { app: 'comic-tracker', version: 1, exportedAt: 1, series: [{ id: 'x' }] };
    await expect(deserialize(JSON.stringify(env))).rejects.toThrow(/title/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/exportImport.test.ts`
Expected: FAIL — cannot resolve `./exportImport`.

- [ ] **Step 3: Implement `src/exportImport.ts`**

```ts
import type { ExportEnvelope, Series, SeriesExport, Status } from './types';
import { STATUSES } from './types';

const APP = 'comic-tracker';
const VERSION = 1;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function serialize(list: Series[]): Promise<string> {
  const series: SeriesExport[] = await Promise.all(
    list.map(async ({ coverBlob, ...rest }) => {
      const out: SeriesExport = { ...rest };
      if (coverBlob) out.coverDataUrl = await blobToDataUrl(coverBlob);
      return out;
    }),
  );
  const envelope: ExportEnvelope = { app: APP, version: VERSION, exportedAt: Date.now(), series };
  return JSON.stringify(envelope, null, 2);
}

function str(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return '';
  throw new Error(`Import failed: field "${field}" must be a string`);
}

function requireStr(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Import failed: record is missing required field "${field}"`);
  }
  return v;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function status(v: unknown): Status {
  return STATUSES.includes(v as Status) ? (v as Status) : 'reading';
}

export async function deserialize(json: string): Promise<Series[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Import failed: file is not valid JSON');
  }
  const env = parsed as Partial<ExportEnvelope>;
  if (env?.app !== APP) throw new Error('Import failed: this is not a comic-tracker export file');
  if (env.version !== VERSION) {
    throw new Error(`Import failed: unsupported export version ${String(env.version)}`);
  }
  if (!Array.isArray(env.series)) throw new Error('Import failed: "series" must be a list');

  const now = Date.now();
  return Promise.all(
    env.series.map(async (raw): Promise<Series> => {
      const r = raw as Record<string, unknown>;
      const coverType = (['url', 'file', 'none'] as const).includes(r.coverType as never)
        ? (r.coverType as Series['coverType'])
        : 'none';
      const series: Series = {
        id: requireStr(r.id ?? crypto.randomUUID(), 'id'),
        title: requireStr(r.title, 'title'),
        author: str(r.author, 'author'),
        link: str(r.link, 'link'),
        linkLabel: str(r.linkLabel, 'linkLabel'),
        lastChapter: Math.max(0, num(r.lastChapter)),
        status: status(r.status),
        coverType,
        coverUrl: str(r.coverUrl, 'coverUrl'),
        createdAt: num(r.createdAt) || now,
        updatedAt: num(r.updatedAt) || now,
      };
      if (coverType === 'file' && typeof r.coverDataUrl === 'string') {
        series.coverBlob = await dataUrlToBlob(r.coverDataUrl);
      }
      return series;
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/exportImport.test.ts`
Expected: PASS (all 7 tests).

> Note: `fetch()` on a `data:` URL works in jsdom/Node 24. If it does not resolve in the test environment, no code change is needed for the app; adjust the test to decode base64 manually. Verify by running the test.

- [ ] **Step 5: Commit**

```bash
git add src/exportImport.ts src/exportImport.test.ts
git commit -m "feat: add self-contained export/import serialization"
```

---

## Task 4: Cover helper

**Files:**
- Create: `src/lib/cover.ts`

- [ ] **Step 1: Implement `src/lib/cover.ts`**

```ts
import type { Series } from '../types';

/** A tiny inline SVG placeholder used when a series has no cover. */
export const PLACEHOLDER_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280">` +
      `<rect width="100%" height="100%" fill="#3a3a3a"/>` +
      `<text x="50%" y="50%" fill="#999" font-family="sans-serif" font-size="16" ` +
      `text-anchor="middle" dominant-baseline="middle">No cover</text></svg>`,
  );

/**
 * Resolve the image src for a series. For file covers, creates an object URL
 * the caller MUST revoke (returned in `revoke`). For url/none, `revoke` is a no-op.
 */
export function resolveCover(series: Series): { src: string; revoke: () => void } {
  if (series.coverType === 'file' && series.coverBlob) {
    const src = URL.createObjectURL(series.coverBlob);
    return { src, revoke: () => URL.revokeObjectURL(src) };
  }
  if (series.coverType === 'url' && series.coverUrl) {
    return { src: series.coverUrl, revoke: () => {} };
  }
  return { src: PLACEHOLDER_COVER, revoke: () => {} };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cover.ts
git commit -m "feat: add cover resolution helper"
```

---

## Task 5: SeriesCard component

**Files:**
- Create: `src/components/SeriesCard.tsx`

- [ ] **Step 1: Implement `src/components/SeriesCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Plus, Minus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { Series } from '../types';
import { resolveCover } from '../lib/cover';

const STATUS_LABEL: Record<Series['status'], string> = {
  reading: 'Reading',
  completed: 'Completed',
  'on-hold': 'On hold',
  dropped: 'Dropped',
};

interface Props {
  series: Series;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (series: Series) => void;
  onDelete: (series: Series) => void;
}

export default function SeriesCard({ series, onIncrement, onDecrement, onEdit, onDelete }: Props) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const { src, revoke } = resolveCover(series);
    setSrc(src);
    return revoke;
  }, [series]);

  return (
    <div className="card">
      <div className="card-cover">
        <img src={src} alt={series.title} />
      </div>
      <div className="card-body">
        <div className="card-title">
          {series.link ? (
            <a href={series.link} target="_blank" rel="noopener noreferrer">
              {series.title} <ExternalLink size={14} />
            </a>
          ) : (
            series.title
          )}
        </div>
        {series.author && <div className="card-author">{series.author}</div>}
        <div className="card-meta">
          <span className={`badge badge-${series.status}`}>{STATUS_LABEL[series.status]}</span>
          {series.linkLabel && <span className="platform">{series.linkLabel}</span>}
        </div>
        <div className="card-chapter">
          <button className="icon-btn" aria-label="Decrement chapter"
            onClick={() => onDecrement(series.id)} disabled={series.lastChapter <= 0}>
            <Minus size={18} />
          </button>
          <span className="chapter-num">Ch. {series.lastChapter}</span>
          <button className="icon-btn primary" aria-label="Increment chapter"
            onClick={() => onIncrement(series.id)}>
            <Plus size={18} />
          </button>
        </div>
        <div className="card-actions">
          <button className="text-btn" onClick={() => onEdit(series)}>
            <Pencil size={14} /> Edit
          </button>
          <button className="text-btn danger" onClick={() => onDelete(series)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SeriesCard.tsx
git commit -m "feat: add SeriesCard with increment as primary action"
```

---

## Task 6: SeriesGrid component

**Files:**
- Create: `src/components/SeriesGrid.tsx`

- [ ] **Step 1: Implement `src/components/SeriesGrid.tsx`**

```tsx
import { BookOpen } from 'lucide-react';
import type { Series } from '../types';
import SeriesCard from './SeriesCard';

interface Props {
  series: Series[];
  totalCount: number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (series: Series) => void;
  onDelete: (series: Series) => void;
}

export default function SeriesGrid({ series, totalCount, ...handlers }: Props) {
  if (series.length === 0) {
    return (
      <div className="empty">
        <BookOpen size={48} />
        <p>{totalCount === 0 ? 'No series yet. Add your first one!' : 'No series match your filters.'}</p>
      </div>
    );
  }
  return (
    <div className="grid">
      {series.map((s) => (
        <SeriesCard key={s.id} series={s} {...handlers} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SeriesGrid.tsx
git commit -m "feat: add SeriesGrid with empty state"
```

---

## Task 7: SeriesFormModal component

**Files:**
- Create: `src/components/SeriesFormModal.tsx`

- [ ] **Step 1: Implement `src/components/SeriesFormModal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Series, Status } from '../types';
import { STATUSES } from '../types';

const STATUS_LABEL: Record<Status, string> = {
  reading: 'Reading', completed: 'Completed', 'on-hold': 'On hold', dropped: 'Dropped',
};

interface Props {
  initial: Series | null; // null = create
  onSave: (series: Series) => void;
  onClose: () => void;
}

export default function SeriesFormModal({ initial, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [linkLabel, setLinkLabel] = useState(initial?.linkLabel ?? '');
  const [lastChapter, setLastChapter] = useState(String(initial?.lastChapter ?? 0));
  const [status, setStatus] = useState<Status>(initial?.status ?? 'reading');
  const [coverMode, setCoverMode] = useState<'url' | 'file'>(
    initial?.coverType === 'file' ? 'file' : 'url',
  );
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? '');
  const [coverBlob, setCoverBlob] = useState<Blob | undefined>(initial?.coverBlob);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (coverMode === 'file' && coverBlob) {
      const url = URL.createObjectURL(coverBlob);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(coverMode === 'url' ? coverUrl : '');
  }, [coverMode, coverBlob, coverUrl]);

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) { setError('Title is required'); return; }
    const chapter = Math.max(0, Number(lastChapter) || 0);
    const now = Date.now();
    const coverType: Series['coverType'] =
      coverMode === 'file' ? (coverBlob ? 'file' : 'none') : coverUrl.trim() ? 'url' : 'none';
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: trimmed,
      author: author.trim(),
      link: link.trim(),
      linkLabel: linkLabel.trim(),
      lastChapter: chapter,
      status,
      coverType,
      coverUrl: coverMode === 'url' ? coverUrl.trim() : '',
      coverBlob: coverMode === 'file' ? coverBlob : undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initial ? 'Edit series' : 'Add series'}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <label>Title*<input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
          <label>Author<input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
          <label>Link<input value={link} placeholder="https://..." onChange={(e) => setLink(e.target.value)} /></label>
          <label>Platform label<input value={linkLabel} placeholder="Webtoons" onChange={(e) => setLinkLabel(e.target.value)} /></label>
          <label>Last chapter
            <input type="number" min={0} value={lastChapter} onChange={(e) => setLastChapter(e.target.value)} />
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <fieldset className="cover-field">
            <legend>Cover</legend>
            <div className="cover-toggle">
              <label><input type="radio" checked={coverMode === 'url'} onChange={() => setCoverMode('url')} /> Image URL</label>
              <label><input type="radio" checked={coverMode === 'file'} onChange={() => setCoverMode('file')} /> Upload file</label>
            </div>
            {coverMode === 'url' ? (
              <input value={coverUrl} placeholder="https://.../cover.jpg" onChange={(e) => setCoverUrl(e.target.value)} />
            ) : (
              <input type="file" accept="image/*"
                onChange={(e) => setCoverBlob(e.target.files?.[0] ?? coverBlob)} />
            )}
            {preview && <img className="cover-preview" src={preview} alt="cover preview" />}
          </fieldset>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="text-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SeriesFormModal.tsx
git commit -m "feat: add add/edit series modal"
```

---

## Task 8: ImportDialog component

**Files:**
- Create: `src/components/ImportDialog.tsx`

- [ ] **Step 1: Implement `src/components/ImportDialog.tsx`**

```tsx
import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { Series } from '../types';
import { deserialize } from '../exportImport';

interface Props {
  onImport: (series: Series[], mode: 'merge' | 'replace') => void;
  onClose: () => void;
}

export default function ImportDialog({ onImport, onClose }: Props) {
  const [parsed, setParsed] = useState<Series[] | null>(null);
  const [error, setError] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function handleFile(file: File) {
    setError('');
    setParsed(null);
    try {
      const text = await file.text();
      const series = await deserialize(text);
      setParsed(series);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <label className="file-drop">
            <Upload size={20} /> Choose an export file (.json)
            <input type="file" accept="application/json,.json" hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          {error && <div className="form-error">{error}</div>}
          {parsed && (
            <div className="import-summary">
              <p>Found <strong>{parsed.length}</strong> series in this file.</p>
              {!confirmReplace ? (
                <div className="import-actions">
                  <button className="primary-btn" onClick={() => onImport(parsed, 'merge')}>
                    Merge into my list
                  </button>
                  <button className="danger-btn" onClick={() => setConfirmReplace(true)}>
                    Replace all
                  </button>
                </div>
              ) : (
                <div className="import-actions">
                  <p className="form-error">This deletes your current list. Are you sure?</p>
                  <button className="danger-btn" onClick={() => onImport(parsed, 'replace')}>
                    Yes, replace everything
                  </button>
                  <button className="text-btn" onClick={() => setConfirmReplace(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImportDialog.tsx
git commit -m "feat: add import dialog with merge/replace modes"
```

---

## Task 9: Toolbar component

**Files:**
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Implement `src/components/Toolbar.tsx`**

```tsx
import { Plus, Search, Download, Upload } from 'lucide-react';
import type { Status } from '../types';

export type SortKey = 'updated' | 'title' | 'chapter';
export type StatusFilter = 'all' | Status;

interface Props {
  search: string;
  statusFilter: StatusFilter;
  sort: SortKey;
  onSearch: (v: string) => void;
  onStatusFilter: (v: StatusFilter) => void;
  onSort: (v: SortKey) => void;
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
}

export default function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <h1 className="app-title">Comic Tracker</h1>
      <div className="search-box">
        <Search size={16} />
        <input placeholder="Search title..." value={p.search}
          onChange={(e) => p.onSearch(e.target.value)} />
      </div>
      <select value={p.statusFilter} onChange={(e) => p.onStatusFilter(e.target.value as StatusFilter)}>
        <option value="all">All statuses</option>
        <option value="reading">Reading</option>
        <option value="completed">Completed</option>
        <option value="on-hold">On hold</option>
        <option value="dropped">Dropped</option>
      </select>
      <select value={p.sort} onChange={(e) => p.onSort(e.target.value as SortKey)}>
        <option value="updated">Recently updated</option>
        <option value="title">Title A–Z</option>
        <option value="chapter">Chapter high→low</option>
      </select>
      <button className="primary-btn" onClick={p.onAdd}><Plus size={16} /> Add</button>
      <button className="text-btn" onClick={p.onExport}><Download size={16} /> Export</button>
      <button className="text-btn" onClick={p.onImport}><Upload size={16} /> Import</button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add toolbar with search/filter/sort/export/import controls"
```

---

## Task 10: App wiring

**Files:**
- Modify: `src/App.tsx` (replace placeholder), `src/index.css` (leave), Create: `src/App.css`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import * as db from './db';
import { serialize } from './exportImport';
import type { Series } from './types';
import Toolbar, { type SortKey, type StatusFilter } from './components/Toolbar';
import SeriesGrid from './components/SeriesGrid';
import SeriesFormModal from './components/SeriesFormModal';
import ImportDialog from './components/ImportDialog';
import './App.css';

export default function App() {
  const [series, setSeries] = useState<Series[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [editing, setEditing] = useState<Series | null | undefined>(undefined); // undefined = closed
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    db.getAll().then(setSeries).catch(() => setError('Failed to load your data.'));
  }, []);

  async function persist(next: Series) {
    setSeries((prev) => {
      const idx = prev.findIndex((s) => s.id === next.id);
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
    try {
      await db.put(next);
    } catch {
      setError('Failed to save. Your change may not persist.');
    }
  }

  function changeChapter(id: string, delta: number) {
    const found = series.find((s) => s.id === id);
    if (!found) return;
    const lastChapter = Math.max(0, found.lastChapter + delta);
    void persist({ ...found, lastChapter, updatedAt: Date.now() });
  }

  async function handleDelete(target: Series) {
    if (!confirm(`Delete "${target.title}"?`)) return;
    setSeries((prev) => prev.filter((s) => s.id !== target.id));
    try {
      await db.remove(target.id);
    } catch {
      setError('Failed to delete.');
    }
  }

  async function handleExport() {
    const json = await serialize(series);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comic-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(imported: Series[], mode: 'merge' | 'replace') {
    try {
      if (mode === 'replace') {
        await db.clear();
        await db.bulkPut(imported);
        setSeries(imported);
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
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = series.filter(
      (s) =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (q === '' || s.title.toLowerCase().includes(q)),
    );
    const sorted = [...filtered];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'chapter') sorted.sort((a, b) => b.lastChapter - a.lastChapter);
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted;
  }, [series, search, statusFilter, sort]);

  return (
    <div className="app">
      <Toolbar
        search={search} statusFilter={statusFilter} sort={sort}
        onSearch={setSearch} onStatusFilter={setStatusFilter} onSort={setSort}
        onAdd={() => setEditing(null)} onExport={handleExport} onImport={() => setImporting(true)}
      />
      {error && <div className="error-banner" onClick={() => setError('')}>{error} (click to dismiss)</div>}
      <SeriesGrid
        series={visible} totalCount={series.length}
        onIncrement={(id) => changeChapter(id, 1)}
        onDecrement={(id) => changeChapter(id, -1)}
        onEdit={(s) => setEditing(s)}
        onDelete={handleDelete}
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
    </div>
  );
}
```

- [ ] **Step 2: Create `src/App.css`** (minimal, functional styling)

```css
.app { max-width: 1200px; margin: 0 auto; padding: 16px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.app-title { font-size: 20px; margin: 0 12px 0 0; }
.search-box { display: flex; align-items: center; gap: 6px; border: 1px solid #888; border-radius: 6px; padding: 4px 8px; }
.search-box input { border: none; outline: none; background: transparent; color: inherit; }
button { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.primary-btn { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; }
.danger-btn { background: #dc2626; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; }
.text-btn { background: transparent; border: 1px solid #888; border-radius: 6px; padding: 6px 12px; color: inherit; }
.text-btn.danger { color: #dc2626; border-color: #dc2626; }
.icon-btn { background: transparent; border: 1px solid #888; border-radius: 6px; padding: 6px; color: inherit; }
.icon-btn.primary { background: #4f46e5; color: #fff; border: none; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.card { border: 1px solid #8884; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.card-cover img { width: 100%; aspect-ratio: 5 / 7; object-fit: cover; display: block; }
.card-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.card-title a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.card-title { font-weight: 600; }
.card-author { font-size: 13px; opacity: 0.7; }
.card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.platform { font-size: 12px; opacity: 0.7; }
.badge { font-size: 11px; padding: 2px 6px; border-radius: 999px; color: #fff; }
.badge-reading { background: #2563eb; }
.badge-completed { background: #16a34a; }
.badge-on-hold { background: #d97706; }
.badge-dropped { background: #6b7280; }
.card-chapter { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.chapter-num { font-weight: 600; }
.card-actions { display: flex; justify-content: space-between; margin-top: 4px; }

.empty { text-align: center; opacity: 0.6; padding: 64px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.error-banner { background: #dc2626; color: #fff; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; cursor: pointer; }

.modal-backdrop { position: fixed; inset: 0; background: #0008; display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 10; }
.modal { background: Canvas; color: CanvasText; border-radius: 10px; width: 100%; max-width: 460px; max-height: 90vh; overflow: auto; }
.modal-header, .modal-footer { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; }
.modal-footer { justify-content: flex-end; gap: 8px; }
.modal-body { padding: 0 16px 8px; display: flex; flex-direction: column; gap: 10px; }
.modal-body label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.modal-body input, .modal-body select { padding: 6px; border-radius: 6px; border: 1px solid #888; background: transparent; color: inherit; }
.cover-field { border: 1px solid #8884; border-radius: 6px; }
.cover-toggle { display: flex; gap: 16px; }
.cover-toggle label { flex-direction: row; align-items: center; }
.cover-preview { max-width: 120px; border-radius: 6px; margin-top: 8px; }
.form-error { color: #dc2626; font-size: 13px; }
.file-drop { display: flex; align-items: center; gap: 8px; border: 1px dashed #888; border-radius: 8px; padding: 16px; cursor: pointer; }
.import-summary { margin-top: 12px; }
.import-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
```

- [ ] **Step 3: Full build and type-check**

Run: `npm run build`
Expected: `tsc -b` passes with no errors, `vite build` produces `dist/`.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all tests in `db.test.ts` and `exportImport.test.ts` pass.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the printed localhost URL. Verify:
- Add a series (title required); it appears as a card.
- Click `+` — chapter increments and card jumps to top (Recently updated).
- Edit, delete (with confirm), search, status filter, sort all work.
- Add a cover via URL and via file upload; preview shows.
- Export downloads a `.json`; reload page (data persists via IndexedDB); Import the file with Merge and with Replace.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire up app state, persistence, export/import"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 2), db (Task 2), export/import incl. base64 (Task 3), cover URL+upload (Tasks 4/7), free link + label (Tasks 5/7), increment primary + decrement (Task 5), CRUD (Tasks 5/7/10), search/filter/sort with `updated` default (Tasks 9/10), reading status (Tasks 2/5/7/9), empty/error handling (Tasks 6/10), export/import UI incl. merge/replace confirm (Tasks 8/10). All covered.
- **Type consistency:** `db` function names (`getAll/get/put/remove/bulkPut/clear`) used identically in App. `Series`/`Status`/`CoverType` from `types.ts`. `SortKey`/`StatusFilter` defined in Toolbar and imported by App.
- **No placeholders:** every code step is complete.
