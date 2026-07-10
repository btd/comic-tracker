import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Series, Status, Publication } from '../types';
import { STATUSES, PUBLICATIONS, STATUS_LABEL, PUBLICATION_LABEL } from '../types';
import { makeThumbnail } from '../lib/thumbnail';
import StarRating from './StarRating';

interface Props {
  initial: Series | null; // null = create
  onSave: (series: Series) => void;
  onClose: () => void;
}

export default function SeriesFormModal({ initial, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [originalTitle, setOriginalTitle] = useState(initial?.originalTitle ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [lastChapter, setLastChapter] = useState(String(initial?.lastChapter ?? 0));
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [status, setStatus] = useState<Status>(initial?.status ?? 'reading');
  const [publication, setPublication] = useState<Publication>(initial?.publication ?? 'unknown');

  // Choosing personal "Completed" auto-fills publication Completed (convenience).
  function changeStatus(next: Status) {
    setStatus(next);
    if (next === 'completed' && publication === 'unknown') setPublication('completed');
  }

  // Non-blocking warnings for odd combinations.
  const warning =
    status === 'completed' && publication !== 'completed'
      ? 'You marked this Completed but the series isn’t set to Completed.'
      : status === 'caught-up' && (publication === 'completed' || publication === 'cancelled')
        ? 'This series is finished — did you mean Completed?'
        : '';
  // Default to file upload; keep URL mode only when editing an existing URL cover.
  const [coverMode, setCoverMode] = useState<'url' | 'file'>(
    initial?.coverType === 'url' ? 'url' : 'file',
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
      originalTitle: originalTitle.trim(),
      author: author.trim(),
      link: link.trim(),
      lastChapter: chapter,
      rating,
      status,
      publication,
      coverType,
      coverUrl: coverMode === 'url' ? coverUrl.trim() : '',
      coverBlob: coverMode === 'file' ? coverBlob : undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      pinned: initial?.pinned ?? false,
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
          <label>Original title
            <input value={originalTitle} placeholder="원제 / 原題 (optional)"
              onChange={(e) => setOriginalTitle(e.target.value)} />
          </label>
          <label>Author<input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
          <label>Link<input value={link} placeholder="https://..." onChange={(e) => setLink(e.target.value)} /></label>
          <label>Last chapter
            <input type="number" min={0} value={lastChapter} onChange={(e) => setLastChapter(e.target.value)} />
          </label>
          <div className="field-label">
            Rating
            <StarRating value={rating} onChange={setRating} />
          </div>
          <label>My status
            <select value={status} onChange={(e) => changeStatus(e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label>Publication
            <select value={publication} onChange={(e) => setPublication(e.target.value as Publication)}>
              {PUBLICATIONS.map((p) => <option key={p} value={p}>{PUBLICATION_LABEL[p]}</option>)}
            </select>
          </label>
          {warning && <div className="form-warning">{warning}</div>}
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
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setCoverBlob(await makeThumbnail(file));
                }} />
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
