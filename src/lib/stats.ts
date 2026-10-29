import type { Game } from '../../shared/types';

export interface PlaytimeBucket {
  label: string;
  count: number;
  finished: number;
}

export interface MonthCount {
  /** e.g. "2026-10" */
  key: string;
  /** e.g. "Oct" */
  label: string;
  year: number;
  count: number;
}

export interface LibraryStats {
  total: number;
  finished: number;
  unfinished: number;
  neverPlayed: number;
  totalMinutes: number;
  finishedMinutes: number;
  buckets: PlaytimeBucket[];
  mostPlayed: Game[];
  finishedByMonth: MonthCount[];
}

/** Upper bounds in minutes (exclusive); the first bucket is exactly zero. */
const BUCKETS: { label: string; below: number }[] = [
  { label: 'Never played', below: 0 },
  { label: 'Under 1 h', below: 60 },
  { label: '1–5 h', below: 5 * 60 },
  { label: '5–20 h', below: 20 * 60 },
  { label: '20–50 h', below: 50 * 60 },
  { label: '50 h+', below: Infinity },
];

export function bucketIndex(minutes: number): number {
  if (minutes <= 0) return 0;
  return BUCKETS.findIndex((bucket, i) => i > 0 && minutes < bucket.below);
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function computeStats(games: Game[], now: Date, topCount = 10): LibraryStats {
  const buckets = BUCKETS.map(({ label }) => ({ label, count: 0, finished: 0 }));
  const months: MonthCount[] = [];
  for (let back = 11; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    months.push({
      key: monthKey(date),
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      year: date.getFullYear(),
      count: 0,
    });
  }
  const monthsByKey = new Map(months.map((month) => [month.key, month]));

  let finished = 0;
  let totalMinutes = 0;
  let finishedMinutes = 0;
  for (const game of games) {
    const isFinished = game.status === 'finished';
    const bucket = buckets[bucketIndex(game.playtimeMinutes)];
    bucket.count++;
    totalMinutes += game.playtimeMinutes;
    if (isFinished) {
      finished++;
      bucket.finished++;
      finishedMinutes += game.playtimeMinutes;
      if (game.finishedAt) {
        const month = monthsByKey.get(monthKey(new Date(game.finishedAt)));
        if (month) month.count++;
      }
    }
  }

  const mostPlayed = games
    .filter((game) => game.playtimeMinutes > 0)
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, topCount);

  return {
    total: games.length,
    finished,
    unfinished: games.length - finished,
    neverPlayed: buckets[0].count,
    totalMinutes,
    finishedMinutes,
    buckets,
    mostPlayed,
    finishedByMonth: months,
  };
}

/** 0.2934 → "29%"; an empty total reads as 0%. */
export function percent(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
}
