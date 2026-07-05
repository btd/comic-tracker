import type { Series } from '../types';

/** A tiny inline SVG placeholder used when a series has no cover. */
export const PLACEHOLDER_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280">` +
      `<rect width="100%" height="100%" fill="#3a3a3a"/>` +
      `<text x="50%" y="50%" fill="#999" font-family="sans-serif" font-size="16" ` +
      `text-anchor="middle" dominant-baseline="middle">No cover</text></svg>`,
  );

/**
 * Resolve the image src for a series. For file covers, creates an object URL
 * the caller MUST revoke (returned in `revoke`). For url/none, `revoke` is a no-op.
 */
export function resolveCover(series: Series): { src: string; revoke: () => void } {
  if (series.coverType === 'file' && series.coverBlob) {
    const src = URL.createObjectURL(series.coverBlob);
    return { src, revoke: () => URL.revokeObjectURL(src) };
  }
  if (series.coverType === 'url' && series.coverUrl) {
    return { src: series.coverUrl, revoke: () => {} };
  }
  return { src: PLACEHOLDER_COVER, revoke: () => {} };
}
