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

export default function App() {
  const [series, setSeries] = useState<Series[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('rating');
  const [editing, setEditing] = useState<Series | null | undefined>(undefined); // undefined = closed
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Load from IndexedDB, backfilling fields added after a record was first stored.
  async function reload() {
    const list = await db.getAll();
    setSeries(
      list.map((s) => ({ ...s, originalTitle: s.originalTitle ?? '', pinned: s.pinned ?? false })),
    );
  }

  useEffect(() => {
    reload().catch(() => setError('Failed to load your data.'));
    db.getMeta().then((m) => setLastBackupAt(m.lastBackupAt)).catch(() => {});
    navigator.storage?.persist?.().then((p) => setPersistent(p)).catch(() => {});
  }, []);

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
      // Reconcile the UI with what actually persisted.
      await reload().catch(() => {});
    }
  }

  function changeChapter(id: string, delta: number) {
    const found = series.find((s) => s.id === id);
    if (!found) return;
    const lastChapter = Math.max(0, found.lastChapter + delta);
    void persist({ ...found, lastChapter, updatedAt: Date.now() });
  }

  function togglePin(id: string) {
    const found = series.find((s) => s.id === id);
    if (!found) return;
    void persist({ ...found, pinned: !found.pinned, updatedAt: Date.now() });
  }

  function rate(id: string, rating: number) {
    const found = series.find((s) => s.id === id);
    if (!found || found.rating === rating) return;
    void persist({ ...found, rating, updatedAt: Date.now() });
  }

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
      // A partial write (e.g. cleared then bulkPut failed) can desync the UI.
      await reload().catch(() => {});
    }
  }

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
    else if (sort === 'updated') sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    else sorted.sort((a, b) => b.rating - a.rating); // 'rating' (default)
    sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned)); // stable: pinned first
    return sorted;
  }, [series, search, statusFilter, sort]);

  const backupStale =
    series.length > 0 && (lastBackupAt === 0 || Date.now() - lastBackupAt > 7 * 86_400_000);

  return (
    <div className="app">
      <Toolbar
        search={search} statusFilter={statusFilter} sort={sort}
        onSearch={setSearch} onStatusFilter={setStatusFilter} onSort={setSort}
        onAdd={() => setEditing(null)} onExport={handleExport} onImport={() => setImporting(true)}
        searchRef={searchRef}
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
        onRate={rate}
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
}
