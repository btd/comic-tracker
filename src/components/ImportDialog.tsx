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
