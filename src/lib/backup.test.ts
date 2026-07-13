import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import { createBackup, readBackup } from './backup';
import type { Series } from '../types';

function make(over: Partial<Series> = {}): Series {
  return {
    id: 'a', title: 'Solo Leveling', originalTitle: '나 혼자만 레벨업', author: 'Chugong', link: '',
    lastChapter: 12, rating: 4.5, status: 'reading', publication: 'ongoing',
    coverType: 'none', coverUrl: '', createdAt: 1, updatedAt: 2, pinned: true, ...over,
  };
}

async function zipEntries(blob: Blob): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe('backup', () => {
  it('round-trips a plain (no-cover) series', async () => {
    const out = await readBackup(await createBackup([make()]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'a', title: 'Solo Leveling', rating: 4.5, status: 'reading',
      publication: 'ongoing', pinned: true,
    });
  });

  it('round-trips a file cover as raw bytes (no base64)', async () => {
    const blob = new Blob(['hello'], { type: 'image/webp' });
    const zip = await createBackup([make({ coverType: 'file', coverBlob: blob })]);
    const entries = await zipEntries(zip);
    // Data separated from images: no base64 inline, cover is its own binary entry.
    const data = strFromU8(entries['data.json']);
    expect(data).not.toContain('coverDataUrl');
    expect(data).toContain('"coverFile"');
    expect(entries['covers/a.webp']).toBeTruthy();

    const out = await readBackup(zip);
    expect(out[0].coverType).toBe('file');
    expect(out[0].coverBlob).toBeInstanceOf(Blob);
    expect(await out[0].coverBlob!.text()).toBe('hello');
  });

  it('round-trips a url cover', async () => {
    const out = await readBackup(await createBackup([make({ coverType: 'url', coverUrl: 'https://x/y.jpg' })]));
    expect(out[0].coverType).toBe('url');
    expect(out[0].coverUrl).toBe('https://x/y.jpg');
    expect(out[0].coverBlob).toBeUndefined();
  });

  it('meta.json carries app + formatVersion', async () => {
    const entries = await zipEntries(await createBackup([make()]));
    const meta = JSON.parse(strFromU8(entries['meta.json']));
    expect(meta.app).toBe('comic-tracker');
    expect(meta.formatVersion).toBe(1);
  });

  it('rejects a non-zip blob', async () => {
    await expect(readBackup(new Blob(['not a zip']))).rejects.toThrow(/valid backup archive/i);
  });

  it('rejects a zip missing meta.json', async () => {
    const zip = zipSync({ 'data.json': strToU8('{"series":[]}') });
    await expect(readBackup(new Blob([zip]))).rejects.toThrow(/missing meta\.json/i);
  });

  it('rejects wrong app', async () => {
    const zip = zipSync({
      'meta.json': strToU8(JSON.stringify({ app: 'nope', formatVersion: 1 })),
      'data.json': strToU8('{"series":[]}'),
    });
    await expect(readBackup(new Blob([zip]))).rejects.toThrow(/not a comic-tracker backup/i);
  });

  it('rejects unsupported formatVersion', async () => {
    const zip = zipSync({
      'meta.json': strToU8(JSON.stringify({ app: 'comic-tracker', formatVersion: 99 })),
      'data.json': strToU8('{"series":[]}'),
    });
    await expect(readBackup(new Blob([zip]))).rejects.toThrow(/format version/i);
  });

  it('degrades a missing referenced cover to none instead of failing', async () => {
    const zip = zipSync({
      'meta.json': strToU8(JSON.stringify({ app: 'comic-tracker', formatVersion: 1 })),
      'data.json': strToU8(JSON.stringify({
        series: [{ id: 'a', title: 'X', coverType: 'file', coverFile: 'a.webp' }],
      })),
    });
    const out = await readBackup(new Blob([zip]));
    expect(out[0].coverType).toBe('none');
    expect(out[0].coverBlob).toBeUndefined();
  });

  it('maps a legacy status value via migrateStatus', async () => {
    const zip = zipSync({
      'meta.json': strToU8(JSON.stringify({ app: 'comic-tracker', formatVersion: 1 })),
      'data.json': strToU8(JSON.stringify({ series: [{ id: 'a', title: 'X', status: 'on-hold' }] })),
    });
    const out = await readBackup(new Blob([zip]));
    expect(out[0].status).toBe('caught-up');
    expect(out[0].publication).toBe('unknown');
  });
});
