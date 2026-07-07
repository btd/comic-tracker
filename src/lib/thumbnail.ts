/**
 * Downscale an image blob to at most `maxWidth` px wide and re-encode as WebP.
 * Returns the original blob unchanged if it isn't an image or if canvas/WebP fails.
 */
export async function makeThumbnail(
  blob: Blob,
  maxWidth = 400,
  quality = 0.82,
): Promise<Blob> {
  if (!blob.type.startsWith('image/')) return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  }
}
