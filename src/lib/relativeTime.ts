const DAY = 86_400_000;

/** Compact relative time from `then` to `now` (both epoch ms). */
export function relativeTime(then: number, now: number = Date.now()): string {
  const diff = now - then;
  if (diff < DAY && diff >= 0) return 'today';
  if (diff < 0) return 'today'; // future guard
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
