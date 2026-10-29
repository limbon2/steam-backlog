import { describe, expect, it } from 'vitest';
import type { Game } from '../../shared/types';
import { bucketIndex, computeStats, percent } from './stats';

const game = (appId: number, overrides: Partial<Game> = {}): Game => ({
  appId,
  name: `Game ${appId}`,
  title: `Game ${appId}`,
  playtimeMinutes: 0,
  lastPlayedAt: null,
  status: 'unfinished',
  finishedAt: null,
  art: {},
  ...overrides,
});

describe('bucketIndex', () => {
  it('puts playtime into the right bucket', () => {
    expect([0, 1, 59, 60, 299, 300, 1199, 1200, 2999, 3000, 99_999].map(bucketIndex)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });
});

describe('computeStats', () => {
  const now = new Date(2026, 9, 30, 12);
  const stats = computeStats(
    [
      game(1, { playtimeMinutes: 3000, status: 'finished', finishedAt: '2026-10-15T12:00:00.000Z' }),
      game(2, { playtimeMinutes: 600, status: 'finished', finishedAt: '2025-06-15T12:00:00.000Z' }),
      game(3, { playtimeMinutes: 30 }),
      game(4),
    ],
    now,
    2,
  );

  it('totals games and hours', () => {
    expect(stats).toMatchObject({ total: 4, finished: 2, unfinished: 2, neverPlayed: 1, totalMinutes: 3630, finishedMinutes: 3600 });
  });

  it('counts finished games per playtime bucket', () => {
    expect(stats.buckets.map((b) => [b.count, b.finished])).toEqual([
      [1, 0],
      [1, 0],
      [0, 0],
      [1, 1],
      [0, 0],
      [1, 1],
    ]);
  });

  it('lists the most played games', () => {
    expect(stats.mostPlayed.map((g) => g.appId)).toEqual([1, 2]);
  });

  it('counts finishes in the last twelve months only', () => {
    expect(stats.finishedByMonth).toHaveLength(12);
    expect(stats.finishedByMonth[0].key).toBe('2025-11');
    expect(stats.finishedByMonth[11]).toMatchObject({ key: '2026-10', label: 'Oct', count: 1 });
    expect(stats.finishedByMonth.reduce((sum, month) => sum + month.count, 0)).toBe(1);
  });
});

describe('percent', () => {
  it('rounds and handles an empty library', () => {
    expect(percent(37, 128)).toBe('29%');
    expect(percent(0, 0)).toBe('0%');
  });
});
