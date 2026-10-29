import type { Game } from '../../shared/types';

export type Filter = 'all' | 'unfinished' | 'finished';
export type SortKey = 'recent' | 'most' | 'least' | 'name';

export const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: 'unfinished', label: 'Unfinished' },
  { key: 'finished', label: 'Finished' },
];

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently played' },
  { key: 'most', label: 'Most played' },
  { key: 'least', label: 'Least played' },
  { key: 'name', label: 'Name' },
];

export function parseFilter(value: string | null): Filter {
  return FILTERS.some((f) => f.key === value) ? (value as Filter) : 'all';
}

export function parseSort(value: string | null): SortKey {
  return SORTS.some((s) => s.key === value) ? (value as SortKey) : 'recent';
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const byTitle = (a: Game, b: Game) => collator.compare(a.title, b.title);

const comparators: Record<SortKey, (a: Game, b: Game) => number> = {
  recent: (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || byTitle(a, b),
  most: (a, b) => b.playtimeMinutes - a.playtimeMinutes || byTitle(a, b),
  least: (a, b) => a.playtimeMinutes - b.playtimeMinutes || byTitle(a, b),
  name: byTitle,
};

/** Lowercase, without accents or punctuation, so "Pokémon: X" matches "pokemon x". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchesQuery(game: Game, query: string): boolean {
  const q = normalize(query);
  return !q || normalize(game.title).includes(q) || normalize(game.name).includes(q);
}

export function visibleGames(games: Game[], filter: Filter, query: string, sort: SortKey): Game[] {
  return games
    .filter((game) => (filter === 'all' || game.status === filter) && matchesQuery(game, query))
    .sort(comparators[sort]);
}

export function countByStatus(games: Game[]): Record<Filter, number> {
  const finished = games.filter((game) => game.status === 'finished').length;
  return { all: games.length, unfinished: games.length - finished, finished };
}

export function lastPlayedGame(games: Game[]): Game | null {
  let latest: Game | null = null;
  for (const game of games) {
    if (game.lastPlayedAt !== null && (latest === null || game.lastPlayedAt > (latest.lastPlayedAt ?? 0))) {
      latest = game;
    }
  }
  return latest;
}
