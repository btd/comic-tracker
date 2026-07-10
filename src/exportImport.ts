import type { ExportEnvelope, Series, SeriesExport } from './types';
import { migrateStatus } from './lib/migrateStatus';

const APP = 'comic-tracker';
const VERSION = 3;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  // `[^,]*?` tolerates MIME parameters (e.g. image/svg+xml;charset=utf-8;base64)
  const match = /^data:([^,]*?)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Import failed: invalid cover data URL');
  const mime = match[1] || '';
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export async function serialize(list: Series[]): Promise<string> {
  const series: SeriesExport[] = await Promise.all(
    list.map(async ({ coverBlob, ...rest }) => {
      const out: SeriesExport = { ...rest };
      if (coverBlob) out.coverDataUrl = await blobToDataUrl(coverBlob);
      return out;
    }),
  );
  const envelope: ExportEnvelope = { app: APP, version: VERSION, exportedAt: Date.now(), series };
  return JSON.stringify(envelope, null, 2);
}

function str(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return '';
  throw new Error(`Import failed: field "${field}" must be a string`);
}

function requireStr(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Import failed: record is missing required field "${field}"`);
  }
  return v;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function bool(v: unknown, dflt = false): boolean {
  return typeof v === 'boolean' ? v : dflt;
}

/** Clamp to 0–5 and snap to the nearest half. Non-numbers → 0. */
function rating(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.min(5, Math.max(0, Math.round(v * 2) / 2));
}


export async function deserialize(json: string): Promise<Series[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Import failed: file is not valid JSON');
  }
  // Parsed input is arbitrary JSON, not a trusted envelope — read fields as unknown.
  const env = parsed as { app?: unknown; version?: unknown; series?: unknown };
  if (env?.app !== APP) throw new Error('Import failed: this is not a comic-tracker export file');
  if (env.version !== 1 && env.version !== 2 && env.version !== 3) {
    throw new Error(`Import failed: unsupported export version ${String(env.version)}`);
  }
  if (!Array.isArray(env.series)) throw new Error('Import failed: "series" must be a list');

  const now = Date.now();
  return env.series.map((raw): Series => {
    const r = raw as unknown as Record<string, unknown>;
    const coverType = (['url', 'file', 'none'] as const).includes(r.coverType as never)
      ? (r.coverType as Series['coverType'])
      : 'none';
    const series: Series = {
      id: requireStr(r.id ?? crypto.randomUUID(), 'id'),
      title: requireStr(r.title, 'title'),
      originalTitle: str(r.originalTitle, 'originalTitle'),
      author: str(r.author, 'author'),
      link: str(r.link, 'link'),
      lastChapter: Math.max(0, num(r.lastChapter)),
      rating: rating(r.rating),
      ...migrateStatus(r.status, r.publication),
      coverType,
      coverUrl: str(r.coverUrl, 'coverUrl'),
      createdAt: num(r.createdAt) || now,
      updatedAt: num(r.updatedAt) || now,
      pinned: bool(r.pinned),
    };
    if (coverType === 'file' && typeof r.coverDataUrl === 'string') {
      series.coverBlob = dataUrlToBlob(r.coverDataUrl);
    }
    return series;
  });
}
