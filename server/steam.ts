import type { ProfileRef } from '../shared/steamInput';
import type { ArtImage, ErrorField, GameArt, SteamProfile } from '../shared/types';
import type { OwnedGame } from './store';

const API = 'https://api.steampowered.com';
const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const ART_BATCH_SIZE = 50;
const ART_PARALLEL_BATCHES = 4;
const TIMEOUT_MS = 20_000;

export type SteamErrorCode =
  | 'invalid_key'
  | 'profile_not_found'
  | 'games_hidden'
  | 'rate_limited'
  | 'unreachable'
  | 'bad_response';

export class SteamError extends Error {
  constructor(
    readonly code: SteamErrorCode,
    message: string,
    readonly field?: ErrorField,
  ) {
    super(message);
    this.name = 'SteamError';
  }
}

interface VanityResponse {
  response?: { success?: number; steamid?: string };
}

interface PlayerSummariesResponse {
  response?: {
    players?: { steamid: string; personaname?: string; avatarfull?: string; profileurl?: string }[];
  };
}

interface OwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: {
      appid: number;
      name?: string;
      playtime_forever?: number;
      rtime_last_played?: number;
      img_icon_url?: string;
    }[];
  };
}

/** Asset file names from IStoreBrowseService/GetItems. */
export interface StoreAssets {
  asset_url_format?: string;
  hero_capsule?: string;
  hero_capsule_2x?: string;
  library_capsule?: string;
  library_capsule_2x?: string;
  header?: string;
  header_2x?: string;
  library_hero?: string;
  library_hero_2x?: string;
}

interface StoreItem {
  appid?: number;
  id?: number;
  success?: number;
  assets?: StoreAssets;
  assets_without_overrides?: StoreAssets;
}

interface GetItemsResponse {
  response?: { store_items?: StoreItem[] };
}

/** Builds artwork URLs from a GetItems `assets` block. */
export function artFromAssets(assets: StoreAssets | undefined): GameArt {
  const format = assets?.asset_url_format;
  if (!assets || !format) return {};
  const url = (file: string | undefined) => (file ? ASSETS + format.replace('${FILENAME}', file) : undefined);
  const image = (file?: string, file2x?: string): ArtImage | undefined => {
    const src = url(file);
    if (!src) return undefined;
    const src2x = url(file2x);
    return src2x ? { src, src2x } : { src };
  };
  return withoutEmpty({
    capsule: image(assets.hero_capsule, assets.hero_capsule_2x),
    library: image(assets.library_capsule, assets.library_capsule_2x),
    header: image(assets.header, assets.header_2x),
    hero: image(assets.library_hero, assets.library_hero_2x),
  });
}

/**
 * Prefers the base artwork over temporary event overrides (which can carry sale or update
 * badges), and fills any gaps from the current artwork.
 */
export function artFromStoreItem(item: StoreItem): GameArt {
  return { ...artFromAssets(item.assets), ...artFromAssets(item.assets_without_overrides) };
}

/** Steam's older fixed asset paths, for games the store no longer lists. They can 404. */
export function legacyArt(appId: number): GameArt {
  const base = `${ASSETS}steam/apps/${appId}/`;
  return {
    library: { src: `${base}library_600x900.jpg`, src2x: `${base}library_600x900_2x.jpg` },
    header: { src: `${base}header.jpg` },
    hero: { src: `${base}library_hero.jpg` },
  };
}

function withoutEmpty(art: GameArt): GameArt {
  return Object.fromEntries(Object.entries(art).filter(([, value]) => value !== undefined)) as GameArt;
}

export function createSteamApi(fetchFn: typeof fetch = fetch) {
  async function getJson<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new SteamError('unreachable', "Couldn't reach Steam. Check your internet connection and try again.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new SteamError('invalid_key', "Steam didn't accept this API key. Check that you copied all 32 characters.", 'apiKey');
    }
    if (res.status === 429) {
      throw new SteamError('rate_limited', 'Steam is limiting requests right now. Try again in a minute.');
    }
    if (!res.ok) throw new SteamError('bad_response', `Steam returned an error (HTTP ${res.status}). Try again later.`);
    try {
      return (await res.json()) as T;
    } catch {
      throw new SteamError('bad_response', 'Steam sent a response Backlog could not read. Try again later.');
    }
  }

  return {
    async resolveSteamId(apiKey: string, ref: ProfileRef): Promise<string> {
      if ('steamId' in ref) return ref.steamId;
      const data = await getJson<VanityResponse>(
        `${API}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(ref.vanity)}`,
      );
      const steamId = data.response?.success === 1 ? data.response.steamid : undefined;
      if (!steamId) {
        throw new SteamError('profile_not_found', `No Steam profile uses the custom URL "${ref.vanity}".`, 'profile');
      }
      return steamId;
    },

    async getProfile(apiKey: string, steamId: string): Promise<SteamProfile> {
      const data = await getJson<PlayerSummariesResponse>(
        `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`,
      );
      const player = data.response?.players?.[0];
      if (!player) throw new SteamError('profile_not_found', "Steam couldn't find that profile.", 'profile');
      return {
        steamId: player.steamid,
        name: player.personaname ?? player.steamid,
        avatarUrl: player.avatarfull ?? '',
        profileUrl: player.profileurl ?? `https://steamcommunity.com/profiles/${player.steamid}/`,
      };
    },

    async getOwnedGames(apiKey: string, steamId: string): Promise<OwnedGame[]> {
      const data = await getJson<OwnedGamesResponse>(
        `${API}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`,
      );
      // A private game list comes back as an empty response rather than an error.
      if (data.response?.game_count === undefined) {
        throw new SteamError(
          'games_hidden',
          "Steam didn't share this account's games. Use an API key from the same account, or set Steam → Privacy Settings → Game details to Public.",
          'profile',
        );
      }
      return (data.response.games ?? []).map((game) => ({
        appId: game.appid,
        name: game.name ?? `App ${game.appid}`,
        playtimeMinutes: game.playtime_forever ?? 0,
        lastPlayedAt: game.rtime_last_played ? game.rtime_last_played * 1000 : null,
        iconHash: game.img_icon_url || null,
      }));
    },

    /**
     * Looks up artwork through Steam's public store API (no key needed). Games the store doesn't
     * list get the legacy paths. Batches that fail are left out so the next sync retries them.
     */
    async getArtwork(appIds: number[]): Promise<Map<number, GameArt>> {
      const result = new Map<number, GameArt>();
      const batches: number[][] = [];
      for (let i = 0; i < appIds.length; i += ART_BATCH_SIZE) batches.push(appIds.slice(i, i + ART_BATCH_SIZE));

      const fetchBatch = async (ids: number[]) => {
        const input = {
          ids: ids.map((appid) => ({ appid })),
          context: { language: 'english', country_code: 'US' },
          data_request: { include_assets: true, include_assets_without_overrides: true },
        };
        try {
          const data = await getJson<GetItemsResponse>(
            `${API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
          );
          const listed = new Map<number, StoreItem>();
          for (const item of data.response?.store_items ?? []) {
            const appId = item.appid ?? item.id;
            if (appId && item.success === 1) listed.set(appId, item);
          }
          for (const appId of ids) {
            const item = listed.get(appId);
            const art = item ? artFromStoreItem(item) : {};
            result.set(appId, Object.keys(art).length ? art : legacyArt(appId));
          }
        } catch (err) {
          console.warn(`Artwork lookup failed for ${ids.length} games: ${(err as Error).message}`);
        }
      };

      for (let i = 0; i < batches.length; i += ART_PARALLEL_BATCHES) {
        await Promise.all(batches.slice(i, i + ART_PARALLEL_BATCHES).map(fetchBatch));
      }
      return result;
    },
  };
}

export type SteamApi = ReturnType<typeof createSteamApi>;
