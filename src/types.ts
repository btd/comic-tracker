export type Status = 'reading' | 'caught-up' | 'plan-to-read' | 'completed' | 'dropped';
export type Publication = 'ongoing' | 'hiatus' | 'completed' | 'cancelled' | 'unknown';
export type CoverType = 'url' | 'file' | 'none';

export interface Series {
  id: string;
  title: string;
  /** Optional original-language title (e.g. Korean/Japanese). Empty string if unused. */
  originalTitle: string;
  author: string;
  link: string;
  lastChapter: number;
  /** 0–5 in 0.5 increments. */
  rating: number;
  status: Status;
  /** The series' own publication state. */
  publication: Publication;
  coverType: CoverType;
  coverUrl: string;
  coverBlob?: Blob;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export const STATUSES: Status[] = ['reading', 'caught-up', 'plan-to-read', 'completed', 'dropped'];
export const PUBLICATIONS: Publication[] = ['ongoing', 'hiatus', 'completed', 'cancelled', 'unknown'];

export const STATUS_LABEL: Record<Status, string> = {
  reading: 'Reading',
  'caught-up': 'Caught up',
  'plan-to-read': 'Plan to read',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const PUBLICATION_LABEL: Record<Publication, string> = {
  ongoing: 'Ongoing',
  hiatus: 'Hiatus',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
};

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
  version: 3;
  exportedAt: number;
  series: SeriesExport[];
}
