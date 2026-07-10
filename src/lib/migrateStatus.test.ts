import { describe, expect, it } from 'vitest';
import { migrateStatus } from './migrateStatus';

describe('migrateStatus', () => {
  it('maps legacy statuses', () => {
    expect(migrateStatus('reading')).toEqual({ status: 'reading', publication: 'unknown' });
    expect(migrateStatus('on-hold')).toEqual({ status: 'caught-up', publication: 'unknown' });
    expect(migrateStatus('completed')).toEqual({ status: 'completed', publication: 'completed' });
    expect(migrateStatus('dropped')).toEqual({ status: 'dropped', publication: 'unknown' });
  });

  it('falls back to reading for unknown values', () => {
    expect(migrateStatus('garbage')).toEqual({ status: 'reading', publication: 'unknown' });
    expect(migrateStatus(undefined)).toEqual({ status: 'reading', publication: 'unknown' });
  });

  it('passes through current values with provided publication', () => {
    expect(migrateStatus('caught-up', 'hiatus')).toEqual({ status: 'caught-up', publication: 'hiatus' });
    expect(migrateStatus('plan-to-read', 'ongoing')).toEqual({ status: 'plan-to-read', publication: 'ongoing' });
  });

  it('defaults publication for current values: completed→completed, else unknown', () => {
    expect(migrateStatus('completed')).toEqual({ status: 'completed', publication: 'completed' });
    expect(migrateStatus('reading', 'bogus')).toEqual({ status: 'reading', publication: 'unknown' });
  });
});
