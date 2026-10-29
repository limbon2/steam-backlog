import { describe, expect, it } from 'vitest';
import type { Game } from '../../shared/types';
import { countByStatus, lastPlayedGame, parseFilter, parseSort, visibleGames } from './library';

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

const games = [
  game(1, { title: 'Hades', playtimeMinutes: 2292, lastPlayedAt: 300, status: 'finished' }),
  game(2, { title: 'Pokémon: Legends', playtimeMinutes: 10, lastPlayedAt: 100 }),
  game(3, { title: 'Outer Wilds' }),
  game(4, { title: 'ELDEN RING', name: 'ELDEN RING', playtimeMinutes: 3744, lastPlayedAt: 200 }),
];

const titles = (list: Game[]) => list.map((g) => g.title);

describe('visibleGames', () => {
  it('sorts by recently played, never played last', () => {
    expect(titles(visibleGames(games, 'all', '', 'recent'))).toEqual(['Hades', 'ELDEN RING', 'Pokémon: Legends', 'Outer Wilds']);
  });

  it('sorts by playtime and by name', () => {
    expect(titles(visibleGames(games, 'all', '', 'most'))).toEqual(['ELDEN RING', 'Hades', 'Pokémon: Legends', 'Outer Wilds']);
    expect(titles(visibleGames(games, 'all', '', 'least'))).toEqual(['Outer Wilds', 'Pokémon: Legends', 'Hades', 'ELDEN RING']);
    expect(titles(visibleGames(games, 'all', '', 'name'))).toEqual(['ELDEN RING', 'Hades', 'Outer Wilds', 'Pokémon: Legends']);
  });

  it('filters by status', () => {
    expect(titles(visibleGames(games, 'finished', '', 'name'))).toEqual(['Hades']);
    expect(visibleGames(games, 'unfinished', '', 'name')).toHaveLength(3);
  });

  it('searches without caring about accents, case or punctuation', () => {
    expect(titles(visibleGames(games, 'all', 'pokemon legends', 'name'))).toEqual(['Pokémon: Legends']);
    expect(titles(visibleGames(games, 'all', 'elden', 'name'))).toEqual(['ELDEN RING']);
    expect(visibleGames(games, 'finished', 'elden', 'name')).toEqual([]);
  });
});

describe('library helpers', () => {
  it('counts games by status', () => {
    expect(countByStatus(games)).toEqual({ all: 4, unfinished: 3, finished: 1 });
  });

  it('finds the last played game', () => {
    expect(lastPlayedGame(games)?.title).toBe('Hades');
    expect(lastPlayedGame([game(9)])).toBeNull();
  });

  it('falls back to defaults for unknown URL values', () => {
    expect(parseFilter('finished')).toBe('finished');
    expect(parseFilter('bogus')).toBe('all');
    expect(parseSort(null)).toBe('recent');
    expect(parseSort('name')).toBe('name');
  });
});
