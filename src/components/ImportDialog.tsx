import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { Series } from '../types';
import { readBackup } from '../lib/backup';

interface Props {
  onImport: (series: Series[], mode: 'merge' | 'replace') => void;
  onClose: () => void;
}

export default function ImportDialog({ onImport, onClose }: Props) {
  const [parsed, setParsed] = useState<Series[] | null>(null);
  const [error, setError] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError('');
    setParsed(null);
    setConfirmReplace(false);
    try {
      const series = await readBackup(file);
      setParsed(series);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Drop zone handles drag-and-drop; the picker is opened by the native
              <label htmlFor> below (no programmatic .click(), which Chrome can suppress). */}
          <div
            className={`file-drop${dragging ? ' dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload size={20} />
            <span>Drag a backup here, or use the button below.</span>
          </div>
          <label htmlFor="import-file-input" className="primary-btn import-choose-btn">
            Choose backup (.zip)…
          </label>
          <input
            id="import-file-input"
            type="file"
            accept="application/zip,.zip"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = ''; // allow re-selecting the same file
            }}
          />
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
