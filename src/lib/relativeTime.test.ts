import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const DAY = 86_400_000;
const now = 1_000 * DAY; // arbitrary fixed "now"

describe('relativeTime', () => {
  it('shows "today" for the same day', () => {
    expect(relativeTime(now, now)).toBe('today');
    expect(relativeTime(now - 3600_000, now)).toBe('today');
  });
  it('shows yesterday and N days', () => {
    expect(relativeTime(now - DAY, now)).toBe('yesterday');
    expect(relativeTime(now - 5 * DAY, now)).toBe('5d ago');
  });
  it('shows weeks and months', () => {
    expect(relativeTime(now - 14 * DAY, now)).toBe('2w ago');
    expect(relativeTime(now - 70 * DAY, now)).toBe('2mo ago');
  });
  it('guards against future timestamps', () => {
    expect(relativeTime(now + DAY, now)).toBe('today');
  });
});
