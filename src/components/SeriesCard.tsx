import { useEffect, useState } from 'react';
import { Plus, Minus, Pencil, Trash2, ExternalLink, Pin, PinOff } from 'lucide-react';
import type { Series } from '../types';
import { PUBLICATION_LABEL } from '../types';
import { resolveCover, PLACEHOLDER_COVER } from '../lib/cover';
import { relativeTime } from '../lib/relativeTime';
import StarRating from './StarRating';

interface Props {
  series: Series;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (series: Series) => void;
  onDelete: (series: Series) => void;
  onTogglePin: (id: string) => void;
  onRate: (id: string, rating: number) => void;
}

export default function SeriesCard({
  series, onIncrement, onDecrement, onEdit, onDelete, onTogglePin, onRate,
}: Props) {
  const [src, setSrc] = useState(PLACEHOLDER_COVER);

  useEffect(() => {
    const { src, revoke } = resolveCover(series);
    setSrc(src);
    return revoke;
  }, [series]);

  return (
    <div
      className="card"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); onIncrement(series.id); }
        else if (e.key === '-') { e.preventDefault(); onDecrement(series.id); }
      }}
    >
      <div className={`card-cover${series.pinned ? ' is-pinned' : ''}`}>
        <img src={src} alt={series.title} />
        {series.pinned && (
          <span className="pin-badge" aria-hidden="true"><Pin size={13} fill="currentColor" /></span>
        )}
        <div className="cover-actions">
          <button
            className={`icon-btn${series.pinned ? ' pinned' : ''}`}
            aria-label={series.pinned ? 'Unpin series' : 'Pin series'}
            aria-pressed={series.pinned}
            onClick={() => onTogglePin(series.id)}
          >
            {series.pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
          <button className="icon-btn" aria-label="Edit series" onClick={() => onEdit(series)}>
            <Pencil size={15} />
          </button>
          <button className="icon-btn danger" aria-label="Delete series" onClick={() => onDelete(series)}>
            <Trash2 size={15} />
          </button>
        </div>
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
        {series.originalTitle && <div className="card-original">{series.originalTitle}</div>}
        {series.author && <div className="card-author">{series.author}</div>}
        <div className="card-meta">
          <StarRating value={series.rating} size={16} onChange={(r) => onRate(series.id, r)} />
          {series.publication !== 'unknown' && (
            <span className={`pub-tag pub-${series.publication}`}>
              {PUBLICATION_LABEL[series.publication]}
            </span>
          )}
        </div>
        <div className="card-updated">Updated {relativeTime(series.updatedAt)}</div>
        <div className="card-chapter">
          <button className="icon-btn" aria-label="Decrement chapter"
            onClick={() => onDecrement(series.id)} disabled={series.lastChapter <= 0}>
            <Minus size={18} />
          </button>
          <span className="chapter-num">
            <small>Chapter</small>
            <b>{series.lastChapter}</b>
          </span>
          <button className="icon-btn primary" aria-label="Increment chapter"
            onClick={() => onIncrement(series.id)}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
