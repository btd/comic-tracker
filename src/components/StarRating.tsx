import { Star, StarHalf } from 'lucide-react';

interface Props {
  value: number; // 0–5, half steps
  onChange?: (value: number) => void; // omit for read-only display
  size?: number;
}

/**
 * Five stars showing a 0–5 rating in half increments.
 * Interactive when `onChange` is given: clicking the left half of a star sets
 * `n - 0.5`, the right half sets `n`; clicking the current value clears to 0.
 */
export default function StarRating({ value, onChange, size = 18 }: Props) {
  const readOnly = !onChange;

  function renderStar(i: number) {
    const filled = value >= i;
    const half = !filled && value >= i - 0.5;
    const icon = half ? (
      <StarHalf size={size} fill="currentColor" />
    ) : (
      <Star size={size} fill={filled ? 'currentColor' : 'none'} />
    );

    if (readOnly) {
      return <span key={i} className={`star${filled || half ? ' on' : ''}`}>{icon}</span>;
    }

    const set = (v: number) => onChange(value === v ? 0 : v);
    return (
      <span key={i} className={`star interactive${filled || half ? ' on' : ''}`}>
        <button type="button" className="star-half left" aria-label={`Rate ${i - 0.5} stars`}
          onClick={() => set(i - 0.5)} />
        <button type="button" className="star-half right" aria-label={`Rate ${i} stars`}
          onClick={() => set(i)} />
        {icon}
      </span>
    );
  }

  return (
    <span
      className="star-rating"
      role={readOnly ? 'img' : undefined}
      aria-label={readOnly ? `Rated ${value} of 5` : undefined}
    >
      {[1, 2, 3, 4, 5].map(renderStar)}
    </span>
  );
}
