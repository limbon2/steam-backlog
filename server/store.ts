import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GameArt, GameStatus, SteamProfile } from '../shared/types';

/** A game as Steam reports it for the connected account. */
export interface OwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  /** Unix time in milliseconds, or null if never played. */
  lastPlayedAt: number | null;
  iconHash: string | null;
}

export interface CachedArt extends GameArt {
  fetchedAt: string;
}

export interface Progress {
  status: GameStatus;
  finishedAt: string | null;
}

export interface StoreData {
  version: 1;
  steam: { apiKey: string; steamId: string; profile: SteamProfile } | null;
  autoSync: boolean;
  lastSyncAt: string | null;
  /** Replaced on every sync. Keyed by app id. */
  games: Record<string, OwnedGame>;
  /** Your Finished marks. Syncing never touches these. Keyed by app id. */
  progress: Record<string, Progress>;
  /** Artwork URLs from Steam's store. Keyed by app id. */
  art: Record<string, CachedArt>;
}

export function emptyData(): StoreData {
  return { version: 1, steam: null, autoSync: true, lastSyncAt: null, games: {}, progress: {}, art: {} };
}

/** Keeps the data in memory and writes it to one JSON file. */
export class Store {
  private data = emptyData();
  private saving: Promise<void> = Promise.resolve();

  constructor(readonly file: string) {}

  async load(): Promise<void> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    try {
      this.data = { ...emptyData(), ...(JSON.parse(text) as Partial<StoreData>), version: 1 };
    } catch (err) {
      throw new Error(`Couldn't read ${this.file}: ${(err as Error).message}`);
    }
  }

  get(): Readonly<StoreData> {
    return this.data;
  }

  /** Applies a change, then saves. Saves run one at a time and replace the file atomically. */
  update(change: (data: StoreData) => void): Promise<void> {
    change(this.data);
    const json = JSON.stringify(this.data, null, 2);
    const write = () => this.write(json);
    this.saving = this.saving.then(write, write);
    return this.saving;
  }

  private async write(json: string): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    await writeFile(temp, json, 'utf8');
    // Antivirus and indexers on Windows sometimes hold the file for a moment.
    for (let attempt = 1; ; attempt++) {
      try {
        await rename(temp, this.file);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
    }
  }
}
