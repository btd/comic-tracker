import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Series } from '../types';
import { migrateStatus } from './migrateStatus';

const APP = 'comic-tracker';
const FORMAT_VERSION = 1;

const MIME_TO_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};
const EXT_TO_MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bin: 'application/octet-stream',
};

// ---- field coercion (self-contained; import input is untrusted) ----
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
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
function bool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false;
}
function rating(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.min(5, Math.max(0, Math.round(v * 2) / 2));
}

/** Build a self-contained .zip backup Blob from the in-memory series. */
export async function createBackup(series: Series[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};

  const records = await Promise.all(
    series.map(async ({ coverBlob, ...rest }) => {
      const record: Record<string, unknown> = { ...rest };
      if (rest.coverType === 'file' && coverBlob) {
        const ext = MIME_TO_EXT[coverBlob.type] ?? 'bin';
        const name = `${rest.id}.${ext}`;
        files[`covers/${name}`] = new Uint8Array(await coverBlob.arrayBuffer());
        record.coverFile = name;
      }
      return record;
    }),
  );

  const meta = { app: APP, formatVersion: FORMAT_VERSION, exportedAt: Date.now() };
  files['meta.json'] = strToU8(JSON.stringify(meta, null, 2));
  files['data.json'] = strToU8(JSON.stringify({ series: records }, null, 2));

  const zipped = zipSync(files);
  return new Blob([zipped], { type: 'application/zip' });
}

/** Parse a .zip backup Blob back into series, re-attaching cover blobs. */
export async function readBackup(file: Blob): Promise<Series[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('Import failed: file is not a valid backup archive');
  }

  const metaRaw = entries['meta.json'];
  if (!metaRaw) throw new Error('Import failed: backup is missing meta.json');
  let meta: { app?: unknown; formatVersion?: unknown };
  try {
    meta = JSON.parse(strFromU8(metaRaw));
  } catch {
    throw new Error('Import failed: meta.json is not valid JSON');
  }
  if (meta.app !== APP) throw new Error('Import failed: this is not a comic-tracker backup');
  if (meta.formatVersion !== FORMAT_VERSION) {
    throw new Error(`Import failed: unsupported backup format version ${String(meta.formatVersion)}`);
  }

  const dataRaw = entries['data.json'];
  if (!dataRaw) throw new Error('Import failed: backup is missing data.json');
  let data: { series?: unknown };
  try {
    data = JSON.parse(strFromU8(dataRaw));
  } catch {
    throw new Error('Import failed: data.json is not valid JSON');
  }
  if (!Array.isArray(data.series)) throw new Error('Import failed: data.json "series" must be a list');

  const now = Date.now();
  return data.series.map((raw): Series => {
    const r = raw as Record<string, unknown>;
    let coverType = (['url', 'file', 'none'] as const).includes(r.coverType as never)
      ? (r.coverType as Series['coverType'])
      : 'none';

    let coverBlob: Blob | undefined;
    if (coverType === 'file' && typeof r.coverFile === 'string') {
      const entry = entries[`covers/${r.coverFile}`];
      if (entry) {
        const ext = r.coverFile.split('.').pop()?.toLowerCase() ?? 'bin';
        // Copy into a fresh ArrayBuffer-backed view so the Blob owns its bytes.
        coverBlob = new Blob([entry.slice()], { type: EXT_TO_MIME[ext] ?? 'application/octet-stream' });
      } else {
        // Referenced cover missing — degrade this record rather than failing the import.
        coverType = 'none';
      }
    }

    const series: Series = {
      id: requireStr(r.id ?? crypto.randomUUID(), 'id'),
      title: requireStr(r.title, 'title'),
      originalTitle: str(r.originalTitle),
      author: str(r.author),
      link: str(r.link),
      lastChapter: Math.max(0, num(r.lastChapter)),
      rating: rating(r.rating),
      ...migrateStatus(r.status, r.publication),
      coverType,
      coverUrl: str(r.coverUrl),
      createdAt: num(r.createdAt) || now,
      updatedAt: num(r.updatedAt) || now,
      pinned: bool(r.pinned),
    };
    if (coverBlob) series.coverBlob = coverBlob;
    return series;
  });
}
