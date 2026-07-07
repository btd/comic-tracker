export type Status = 'reading' | 'completed' | 'on-hold' | 'dropped';
export type CoverType = 'url' | 'file' | 'none';

export interface Series {
  id: string;
  title: string;
  /** Optional original-language title (e.g. Korean/Japanese). Empty string if unused. */
  originalTitle: string;
  author: string;
  link: string;
  linkLabel: string;
  lastChapter: number;
  status: Status;
  coverType: CoverType;
  coverUrl: string;
  coverBlob?: Blob;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export const STATUSES: Status[] = ['reading', 'completed', 'on-hold', 'dropped'];

export interface Meta {
  /** epoch ms of last successful export; 0 = never backed up */
  lastBackupAt: number;
}

export const DEFAULT_META: Meta = { lastBackupAt: 0 };

/** A Series as it appears in an export file: blob replaced by a base64 data URL. */
export interface SeriesExport extends Omit<Series, 'coverBlob'> {
  coverDataUrl?: string;
}

export interface ExportEnvelope {
  app: 'comic-tracker';
  version: 2;
  exportedAt: number;
  series: SeriesExport[];
}
