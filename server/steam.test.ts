import { describe, expect, it, vi } from 'vitest';
import { artFromStoreItem, createSteamApi, legacyArt, SteamError } from './steam';

const KEY = '0123456789abcdef0123456789abcdef';
const STEAM_ID = '76561198000000000';
const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function steamWith(handler: (url: URL) => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (input: string | URL | Request) => handler(new URL(String(input))));
  return { steam: createSteamApi(fetchFn as unknown as typeof fetch), fetchFn };
}

async function steamError(promise: Promise<unknown>): Promise<SteamError> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(SteamError);
  return error as SteamError;
}

describe('getOwnedGames', () => {
  it('maps Steam games to library entries', async () => {
    const { steam, fetchFn } = steamWith(() =>
      json({
        response: {
          game_count: 2,
          games: [
            { appid: 10, name: 'Counter-Strike', playtime_forever: 125, rtime_last_played: 1_700_000_000, img_icon_url: 'abc' },
            { appid: 20, name: 'Unplayed', playtime_forever: 0, rtime_last_played: 0 },
          ],
        },
      }),
    );

    expect(await steam.getOwnedGames(KEY, STEAM_ID)).toEqual([
      { appId: 10, name: 'Counter-Strike', playtimeMinutes: 125, lastPlayedAt: 1_700_000_000_000, iconHash: 'abc' },
      { appId: 20, name: 'Unplayed', playtimeMinutes: 0, lastPlayedAt: null, iconHash: null },
    ]);
    const url = new URL(String(fetchFn.mock.calls[0][0]));
    expect(url.pathname).toBe('/IPlayerService/GetOwnedGames/v1/');
    expect(url.searchParams.get('include_appinfo')).toBe('1');
    expect(url.searchParams.get('include_played_free_games')).toBe('1');
  });

  it('explains a private game list', async () => {
    const { steam } = steamWith(() => json({ response: {} }));
    const error = await steamError(steam.getOwnedGames(KEY, STEAM_ID));
    expect(error.code).toBe('games_hidden');
    expect(error.message).toContain('Game details to Public');
  });

  it('flags a rejected API key on the key field', async () => {
    const { steam } = steamWith(() => new Response('Forbidden', { status: 403 }));
    const error = await steamError(steam.getOwnedGames(KEY, STEAM_ID));
    expect(error.code).toBe('invalid_key');
    expect(error.field).toBe('apiKey');
  });

  it('reports when Steam is unreachable', async () => {
    const { steam } = steamWith(() => {
      throw new TypeError('fetch failed');
    });
    expect((await steamError(steam.getOwnedGames(KEY, STEAM_ID))).code).toBe('unreachable');
  });
});

describe('resolveSteamId', () => {
  it('uses a SteamID64 as is', async () => {
    const { steam, fetchFn } = steamWith(() => json({}));
    expect(await steam.resolveSteamId(KEY, { steamId: STEAM_ID })).toBe(STEAM_ID);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('resolves a custom URL name', async () => {
    const { steam, fetchFn } = steamWith(() => json({ response: { success: 1, steamid: STEAM_ID } }));
    expect(await steam.resolveSteamId(KEY, { vanity: 'gaben' })).toBe(STEAM_ID);
    expect(new URL(String(fetchFn.mock.calls[0][0])).searchParams.get('vanityurl')).toBe('gaben');
  });

  it('reports an unknown custom URL on the profile field', async () => {
    const { steam } = steamWith(() => json({ response: { success: 42, message: 'No match' } }));
    const error = await steamError(steam.resolveSteamId(KEY, { vanity: 'nobody-here' }));
    expect(error.code).toBe('profile_not_found');
    expect(error.field).toBe('profile');
  });
});

describe('getProfile', () => {
  it('reads the persona name and avatar', async () => {
    const { steam } = steamWith(() =>
      json({
        response: {
          players: [
            { steamid: STEAM_ID, personaname: 'Player', avatarfull: 'https://avatars/full.jpg', profileurl: 'https://steamcommunity.com/id/player/' },
          ],
        },
      }),
    );
    expect(await steam.getProfile(KEY, STEAM_ID)).toEqual({
      steamId: STEAM_ID,
      name: 'Player',
      avatarUrl: 'https://avatars/full.jpg',
      profileUrl: 'https://steamcommunity.com/id/player/',
    });
  });
});

describe('artwork', () => {
  it('prefers art without event overrides and fills gaps from the current art', () => {
    const art = artFromStoreItem({
      success: 1,
      assets: {
        asset_url_format: 'steam/apps/1/${FILENAME}?t=2',
        hero_capsule: 'event/hero_capsule_alt.jpg',
        header: 'header.jpg',
      },
      assets_without_overrides: {
        asset_url_format: 'steam/apps/1/${FILENAME}?t=1',
        hero_capsule: 'base/hero_capsule.jpg',
        hero_capsule_2x: 'base/hero_capsule_2x.jpg',
      },
    });
    expect(art.capsule).toEqual({
      src: `${ASSETS}steam/apps/1/base/hero_capsule.jpg?t=1`,
      src2x: `${ASSETS}steam/apps/1/base/hero_capsule_2x.jpg?t=1`,
    });
    expect(art.header).toEqual({ src: `${ASSETS}steam/apps/1/header.jpg?t=2` });
    expect(art.library).toBeUndefined();
  });

  it('looks games up in batches and uses legacy paths for unlisted ones', async () => {
    const { steam, fetchFn } = steamWith((url) => {
      const input = JSON.parse(url.searchParams.get('input_json')!) as { ids: { appid: number }[] };
      return json({
        response: {
          store_items: input.ids.map(({ appid }) =>
            appid === 7
              ? { appid, success: 2 }
              : { appid, success: 1, assets: { asset_url_format: `steam/apps/${appid}/\${FILENAME}`, hero_capsule: 'hero_capsule.jpg' } },
          ),
        },
      });
    });

    const art = await steam.getArtwork(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(art.size).toBe(60);
    expect(art.get(7)).toEqual(legacyArt(7));
    expect(art.get(8)?.capsule?.src).toBe(`${ASSETS}steam/apps/8/hero_capsule.jpg`);
  });

  it('leaves out failed batches so the next sync retries them', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { steam } = steamWith(() => new Response('busy', { status: 503 }));
    expect((await steam.getArtwork([1, 2, 3])).size).toBe(0);
  });
});
