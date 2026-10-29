import type { GameArt, SteamProfile } from '../shared/types';
import type { SteamApi } from './steam';
import type { OwnedGame, Store, StoreData } from './store';

/** Artwork older than this is looked up again, in case the game's art changed. */
const ART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface Credentials {
  apiKey: string;
  steamId: string;
}

export interface SyncResult {
  profile: SteamProfile;
  games: OwnedGame[];
  art: Map<number, GameArt>;
  now: Date;
}

/** Records a sync. Finished marks live in `progress`, which this never touches. */
export function applySync(data: StoreData, credentials: Credentials, result: SyncResult): void {
  const syncedAt = result.now.toISOString();
  data.steam = { ...credentials, profile: result.profile };
  data.games = Object.fromEntries(result.games.map((game) => [String(game.appId), game]));
  for (const [appId, art] of result.art) data.art[String(appId)] = { ...art, fetchedAt: syncedAt };
  data.lastSyncAt = syncedAt;
}

export function appsNeedingArt(data: StoreData, games: OwnedGame[], now: Date): number[] {
  return games
    .filter((game) => {
      const cached = data.art[String(game.appId)];
      return !cached || now.getTime() - Date.parse(cached.fetchedAt) > ART_MAX_AGE_MS;
    })
    .map((game) => game.appId);
}

export function createSyncer(store: Store, steam: SteamApi) {
  let running: Promise<void> | null = null;

  async function fetchLibrary(credentials: Credentials): Promise<void> {
    const [profile, games] = await Promise.all([
      steam.getProfile(credentials.apiKey, credentials.steamId),
      steam.getOwnedGames(credentials.apiKey, credentials.steamId),
    ]);
    const now = new Date();
    const art = await steam.getArtwork(appsNeedingArt(store.get(), games, now));
    await store.update((data) => applySync(data, credentials, { profile, games, art, now }));
  }

  function run(credentials: Credentials): Promise<void> {
    const current = fetchLibrary(credentials).finally(() => {
      if (running === current) running = null;
    });
    running = current;
    return current;
  }

  return {
    /** Syncs with the saved credentials. A call made during a sync waits for that sync. */
    sync(): Promise<void> {
      if (running) return running;
      const steam = store.get().steam;
      if (!steam) return Promise.reject(new Error('Steam is not connected.'));
      return run({ apiKey: steam.apiKey, steamId: steam.steamId });
    },

    /** Syncs with new credentials. They're saved only if the sync succeeds. */
    async connect(credentials: Credentials): Promise<void> {
      await running?.catch(() => {});
      return run(credentials);
    },
  };
}
