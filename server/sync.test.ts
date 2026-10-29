import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SteamProfile } from '../shared/types';
import type { SteamApi } from './steam';
import { emptyData, Store, type OwnedGame } from './store';
import { applySync, appsNeedingArt, createSyncer } from './sync';

const profile: SteamProfile = { steamId: '76561198000000000', name: 'Player', avatarUrl: '', profileUrl: '' };
const credentials = { apiKey: '0123456789abcdef0123456789abcdef', steamId: profile.steamId };
const game = (appId: number, playtimeMinutes = 60): OwnedGame => ({
  appId,
  name: `Game ${appId}`,
  playtimeMinutes,
  lastPlayedAt: null,
  iconHash: null,
});

describe('applySync', () => {
  it('replaces the games but keeps finished marks', () => {
    const data = emptyData();
    data.games['1'] = game(1);
    data.games['3'] = game(3);
    data.progress['1'] = { status: 'finished', finishedAt: '2026-01-01T00:00:00.000Z' };
    data.progress['3'] = { status: 'finished', finishedAt: '2026-02-01T00:00:00.000Z' };
    const now = new Date('2026-10-30T12:00:00.000Z');

    applySync(data, credentials, {
      profile,
      games: [game(1, 120), game(2)],
      art: new Map([[2, { header: { src: 'header.jpg' } }]]),
      now,
    });

    expect(Object.keys(data.games)).toEqual(['1', '2']);
    expect(data.games['1'].playtimeMinutes).toBe(120);
    expect(data.progress).toEqual({
      '1': { status: 'finished', finishedAt: '2026-01-01T00:00:00.000Z' },
      '3': { status: 'finished', finishedAt: '2026-02-01T00:00:00.000Z' },
    });
    expect(data.art['2']).toEqual({ header: { src: 'header.jpg' }, fetchedAt: now.toISOString() });
    expect(data.steam).toEqual({ ...credentials, profile });
    expect(data.lastSyncAt).toBe(now.toISOString());
  });
});

describe('appsNeedingArt', () => {
  it('asks only for missing or month-old artwork', () => {
    const data = emptyData();
    data.art['1'] = { fetchedAt: '2026-10-29T00:00:00.000Z' };
    data.art['2'] = { fetchedAt: '2026-08-01T00:00:00.000Z' };
    expect(appsNeedingArt(data, [game(1), game(2), game(3)], new Date('2026-10-30T00:00:00.000Z'))).toEqual([2, 3]);
  });
});

describe('createSyncer', () => {
  let dir: string;
  let store: Store;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'backlog-test-'));
    store = new Store(path.join(dir, 'backlog.json'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const fakeSteam = (games: () => Promise<OwnedGame[]>) => ({
    resolveSteamId: vi.fn(),
    getProfile: vi.fn(async () => profile),
    getOwnedGames: vi.fn(games),
    getArtwork: vi.fn(async () => new Map()),
  });

  it('shares one run between overlapping syncs and saves the result', async () => {
    await store.update((data) => {
      data.steam = { ...credentials, profile };
    });
    const steam = fakeSteam(async () => [game(1)]);
    const syncer = createSyncer(store, steam as unknown as SteamApi);

    await Promise.all([syncer.sync(), syncer.sync()]);

    expect(steam.getOwnedGames).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(await readFile(store.file, 'utf8')) as ReturnType<typeof emptyData>;
    expect(Object.keys(saved.games)).toEqual(['1']);
    expect(saved.lastSyncAt).not.toBeNull();
  });

  it('keeps the old connection when new credentials fail', async () => {
    const steam = fakeSteam(async () => {
      throw new Error('games hidden');
    });
    const syncer = createSyncer(store, steam as unknown as SteamApi);

    await expect(syncer.connect(credentials)).rejects.toThrow('games hidden');
    expect(store.get().steam).toBeNull();
  });

  it('refuses to sync before Steam is connected', async () => {
    const syncer = createSyncer(store, fakeSteam(async () => []) as unknown as SteamApi);
    await expect(syncer.sync()).rejects.toThrow('not connected');
  });
});
