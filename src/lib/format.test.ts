import { describe, expect, it } from 'vitest';
import { formatHours, formatWholeHours, relativeTime } from './format';

describe('formatHours', () => {
  it('shows one decimal like the mockup', () => {
    expect(formatHours(3744)).toBe('62.4 h');
    expect(formatHours(0)).toBe('0.0 h');
    expect(formatHours(75_000)).toBe('1,250.0 h');
  });

  it('rounds to whole hours for totals', () => {
    expect(formatWholeHours(74_048)).toBe('1,234 h');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-10-30T12:00:00.000Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [10_000, 'just now'],
    [60_000, '1 minute ago'],
    [5 * 60_000, '5 minutes ago'],
    [3 * 3_600_000, '3 hours ago'],
    [26 * 3_600_000, 'yesterday'],
    [10 * 86_400_000, '10 days ago'],
  ])('%i ms ago reads %j', (ms, expected) => {
    expect(relativeTime(ago(ms), now)).toBe(expected);
  });
});
