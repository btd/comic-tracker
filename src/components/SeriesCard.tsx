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
