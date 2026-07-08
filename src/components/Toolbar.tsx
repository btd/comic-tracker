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
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export default function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <h1 className="app-title">Comic Tracker</h1>
      <div className="search-box">
        <Search size={16} />
        <input ref={p.searchRef} placeholder="Search title..." value={p.search}
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
      <span className="spacer" />
      <button className="primary-btn" onClick={p.onAdd}><Plus size={16} /> Add</button>
      <button className="text-btn" onClick={p.onExport}><Download size={16} /> Export</button>
      <button className="text-btn" onClick={p.onImport}><Upload size={16} /> Import</button>
    </div>
  );
}
