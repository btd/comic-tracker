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
  onTogglePin: (id: string) => void;
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
