import type { Status, Publication } from '../types';
import { STATUSES, PUBLICATIONS } from '../types';

/**
 * Map a possibly-legacy status/publication pair onto the current two-axis model.
 * Legacy single-field values ('on-hold') and unknowns are normalized. Used by both
 * the IndexedDB load backfill and import deserialization so old data re-buckets safely.
 */
export function migrateStatus(
  rawStatus: unknown,
  rawPublication?: unknown,
): { status: Status; publication: Publication } {
  // Current values pass through.
  if (STATUSES.includes(rawStatus as Status)) {
    const status = rawStatus as Status;
    const publication = PUBLICATIONS.includes(rawPublication as Publication)
      ? (rawPublication as Publication)
      : status === 'completed'
        ? 'completed'
        : 'unknown';
    return { status, publication };
  }

  // Legacy single-field mapping.
  switch (rawStatus) {
    case 'on-hold':
      return { status: 'caught-up', publication: 'unknown' };
    case 'completed':
      return { status: 'completed', publication: 'completed' };
    case 'dropped':
      return { status: 'dropped', publication: 'unknown' };
    case 'reading':
      return { status: 'reading', publication: 'unknown' };
    default:
      return { status: 'reading', publication: 'unknown' };
  }
}
