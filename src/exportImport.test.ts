import { describe, expect, it } from 'vitest';
import { serialize, deserialize } from './exportImport';
import type { Series } from './types';

function make(over: Partial<Series> = {}): Series {
  return {
    id: 'a', title: 'Solo Leveling', author: 'Chugong', link: '', linkLabel: '',
    lastChapter: 12, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: 2, ...over,
  };
}

describe('exportImport', () => {
  it('round-trips a plain series through serialize/deserialize', async () => {
    const out = await deserialize(await serialize([make()]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', title: 'Solo Leveling', lastChapter: 12 });
  });

  it('round-trips a file cover as blob -> base64 -> blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const json = await serialize([make({ coverType: 'file', coverBlob: blob })]);
    expect(json).not.toContain('[object Blob]');
    expect(json).toContain('coverDataUrl');
    const out = await deserialize(json);
    expect(out[0].coverType).toBe('file');
    expect(out[0].coverBlob).toBeInstanceOf(Blob);
    expect(await out[0].coverBlob!.text()).toBe('hello');
  });

  it('decodes a file cover whose data URL carries MIME parameters', async () => {
    const env = {
      app: 'comic-tracker', version: 1, exportedAt: 1,
      series: [{
        id: 'a', title: 'T', coverType: 'file',
        coverDataUrl: 'data:image/svg+xml;charset=utf-8;base64,PHN2Zz48L3N2Zz4=',
      }],
    };
    const out = await deserialize(JSON.stringify(env));
    expect(out[0].coverBlob).toBeInstanceOf(Blob);
    expect(await out[0].coverBlob!.text()).toBe('<svg></svg>');
  });

  it('ignores unknown extra fields (forward compatible)', async () => {
    const env = JSON.parse(await serialize([make()]));
    env.series[0].somethingNew = 42;
    const out = await deserialize(JSON.stringify(env));
    expect(out[0].id).toBe('a');
  });

  it('rejects wrong app', async () => {
    await expect(deserialize(JSON.stringify({ app: 'nope', version: 1, series: [] })))
      .rejects.toThrow(/not a comic-tracker/i);
  });

  it('rejects unsupported version', async () => {
    await expect(deserialize(JSON.stringify({ app: 'comic-tracker', version: 99, series: [] })))
      .rejects.toThrow(/version/i);
  });

  it('rejects malformed json', async () => {
    await expect(deserialize('{not json')).rejects.toThrow();
  });

  it('rejects a record missing a title', async () => {
    const env = { app: 'comic-tracker', version: 1, exportedAt: 1, series: [{ id: 'x' }] };
    await expect(deserialize(JSON.stringify(env))).rejects.toThrow(/title/i);
  });
});
