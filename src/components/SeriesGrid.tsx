import { BookOpen } from 'lucide-react';
import type { Series, Status } from '../types';
import SeriesCard from './SeriesCard';

interface Props {
  series: Series[];
  totalCount: number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (series: Series) => void;
  onDelete: (series: Series) => void;
  onTogglePin: (id: string) => void;
  onRate: (id: string, rating: number) => void;
}

// Section order and labels.
const SECTIONS: { status: Status; label: string }[] = [
  { status: 'reading', label: 'Reading' },
  { status: 'caught-up', label: 'Caught up' },
  { status: 'plan-to-read', label: 'Plan to read' },
  { status: 'completed', label: 'Completed' },
  { status: 'dropped', label: 'Dropped' },
];

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
    <>
      {SECTIONS.map(({ status, label }) => {
        const items = series.filter((s) => s.status === status);
        if (items.length === 0) return null;
        return (
          <section key={status} className="status-section">
            <h2 className="section-heading">
              {label} <span className="section-count">{items.length}</span>
            </h2>
            <div className="grid">
              {items.map((s) => (
                <SeriesCard key={s.id} series={s} {...handlers} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
