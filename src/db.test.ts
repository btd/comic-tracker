import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getAll, get, put, remove, bulkPut, clear } from './db';
import type { Series } from './types';

function make(id: string, over: Partial<Series> = {}): Series {
  return {
    id, title: `T${id}`, originalTitle: '', author: '', link: '', linkLabel: '',
    lastChapter: 0, status: 'reading', coverType: 'none', coverUrl: '',
    createdAt: 1, updatedAt: 1, ...over,
  };
}

describe('db', () => {
  beforeEach(async () => { await clear(); });

  it('put then getAll returns the record', async () => {
    await put(make('a'));
    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a');
  });

  it('get returns one record or undefined', async () => {
    await put(make('a'));
    expect((await get('a'))?.id).toBe('a');
    expect(await get('missing')).toBeUndefined();
  });

  it('put updates an existing record', async () => {
    await put(make('a', { lastChapter: 1 }));
    await put(make('a', { lastChapter: 5 }));
    expect((await get('a'))?.lastChapter).toBe(5);
    expect(await getAll()).toHaveLength(1);
  });

  it('remove deletes a record', async () => {
    await put(make('a'));
    await remove('a');
    expect(await getAll()).toHaveLength(0);
  });

  it('bulkPut inserts many; clear empties store', async () => {
    await bulkPut([make('a'), make('b')]);
    expect(await getAll()).toHaveLength(2);
    await clear();
    expect(await getAll()).toHaveLength(0);
  });
});
