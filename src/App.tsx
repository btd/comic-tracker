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
