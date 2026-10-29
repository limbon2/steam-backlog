import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { displayName } from '../shared/displayName';
import { isValidApiKey, parseProfileInput } from '../shared/steamInput';
import type {
  ApiErrorBody,
  ConnectRequest,
  Game,
  GameArt,
  LibraryResponse,
  SettingsResponse,
} from '../shared/types';
import { createSteamApi, legacyArt, SteamError } from './steam';
import { detectSteamAccounts } from './steamLocal';
import { Store, type CachedArt, type OwnedGame, type StoreData } from './store';
import { createSyncer } from './sync';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BACKLOG_PORT) || 4777;

const store = new Store(process.env.BACKLOG_DATA_FILE ?? path.join(root, 'data', 'backlog.json'));
await store.load();
const steam = createSteamApi();
const syncer = createSyncer(store, steam);

function artFor(game: OwnedGame, cached: CachedArt | undefined): GameArt {
  const legacy = legacyArt(game.appId);
  const art: GameArt = {
    capsule: cached?.capsule,
    library: cached?.library ?? legacy.library,
    header: cached?.header ?? legacy.header,
    hero: cached?.hero ?? legacy.hero,
  };
  if (game.iconHash) {
    art.icon = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appId}/${game.iconHash}.jpg`;
  }
  return art;
}

function toGame(data: StoreData, appId: string): Game {
  const game = data.games[appId];
  const progress = data.progress[appId];
  return {
    appId: game.appId,
    name: game.name,
    title: displayName(game.name),
    playtimeMinutes: game.playtimeMinutes,
    lastPlayedAt: game.lastPlayedAt,
    status: progress?.status ?? 'unfinished',
    finishedAt: progress?.finishedAt ?? null,
    art: artFor(game, data.art[appId]),
  };
}

function libraryResponse(data: StoreData): LibraryResponse {
  return {
    connected: data.steam !== null,
    profile: data.steam?.profile ?? null,
    lastSyncAt: data.lastSyncAt,
    autoSync: data.autoSync,
    games: Object.keys(data.games).map((appId) => toGame(data, appId)),
  };
}

function settingsResponse(data: StoreData): SettingsResponse {
  return {
    connected: data.steam !== null,
    profile: data.steam?.profile ?? null,
    apiKeyHint: data.steam ? `••••${data.steam.apiKey.slice(-4)}` : null,
    autoSync: data.autoSync,
    lastSyncAt: data.lastSyncAt,
    dataFile: store.file,
  };
}

function errorResponse(c: Context, err: unknown) {
  if (err instanceof SteamError) {
    const status = err.code === 'unreachable' ? 502 : err.code === 'rate_limited' ? 429 : 400;
    return c.json<ApiErrorBody>({ message: err.message, field: err.field }, status);
  }
  console.error(err);
  return c.json<ApiErrorBody>({ message: err instanceof Error ? err.message : 'Something went wrong.' }, 500);
}

async function readJson<T>(c: Context): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

const app = new Hono();

// Only answer requests addressed to this machine (blocks DNS-rebinding tricks), and require
// JSON on writes so other websites can't submit forms to the API.
app.use('/api/*', async (c, next) => {
  const host = (c.req.header('host') ?? '').replace(/:\d+$/, '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return c.json({ message: 'Forbidden' }, 403);
  if (c.req.method !== 'GET' && !c.req.header('content-type')?.includes('application/json')) {
    return c.json({ message: 'Expected a JSON request.' }, 415);
  }
  await next();
});

app.get('/api/library', (c) => c.json(libraryResponse(store.get())));

app.post('/api/sync', async (c) => {
  try {
    await syncer.sync();
  } catch (err) {
    return errorResponse(c, err);
  }
  return c.json(libraryResponse(store.get()));
});

app.patch('/api/games/:appId', async (c) => {
  const appId = c.req.param('appId');
  const { status } = await readJson<Pick<Game, 'status'>>(c);
  if (status !== 'finished' && status !== 'unfinished') {
    return c.json<ApiErrorBody>({ message: 'Status must be "finished" or "unfinished".' }, 400);
  }
  if (!store.get().games[appId]) return c.json<ApiErrorBody>({ message: 'That game is not in your library.' }, 404);

  await store.update((data) => {
    if (status === 'unfinished') {
      delete data.progress[appId];
    } else if (data.progress[appId]?.status !== 'finished') {
      data.progress[appId] = { status, finishedAt: new Date().toISOString() };
    }
  });
  return c.json(toGame(store.get(), appId));
});

app.get('/api/settings', (c) => c.json(settingsResponse(store.get())));

app.patch('/api/settings', async (c) => {
  const { autoSync } = await readJson<SettingsResponse>(c);
  if (typeof autoSync === 'boolean') {
    await store.update((data) => {
      data.autoSync = autoSync;
    });
  }
  return c.json(settingsResponse(store.get()));
});

app.get('/api/steam/detect', async (c) => c.json({ accounts: await detectSteamAccounts() }));

app.put('/api/settings/steam', async (c) => {
  const body = await readJson<ConnectRequest>(c);
  const apiKey = body.apiKey?.trim() || store.get().steam?.apiKey || '';
  if (!isValidApiKey(apiKey)) {
    return c.json<ApiErrorBody>(
      { field: 'apiKey', message: 'A Steam Web API key is 32 characters long, using 0–9 and A–F.' },
      400,
    );
  }
  const ref = parseProfileInput(body.profile ?? '');
  if (!ref) {
    return c.json<ApiErrorBody>(
      { field: 'profile', message: 'Enter a Steam profile URL, a custom URL name or a SteamID64.' },
      400,
    );
  }

  try {
    const steamId = await steam.resolveSteamId(apiKey, ref);
    await syncer.connect({ apiKey, steamId });
  } catch (err) {
    return errorResponse(c, err);
  }
  return c.json(libraryResponse(store.get()));
});

app.delete('/api/settings/steam', async (c) => {
  await store.update((data) => {
    data.steam = null;
    data.games = {};
    data.lastSyncAt = null;
  });
  return c.json(libraryResponse(store.get()));
});

app.all('/api/*', (c) => c.json<ApiErrorBody>({ message: 'Not found.' }, 404));

// After `npm run build`, serve the app itself too.
const dist = path.join(root, 'dist');
const indexFile = path.join(dist, 'index.html');
const hasBuild = existsSync(indexFile);
if (hasBuild) {
  const indexHtml = readFileSync(indexFile, 'utf8');
  app.use('*', serveStatic({ root: path.relative(process.cwd(), dist) || '.' }));
  app.get('*', (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
  console.log(
    hasBuild ? `Backlog is running at http://localhost:${port}` : `Backlog API listening on http://127.0.0.1:${port}`,
  );
});
