export type GameStatus = 'finished' | 'unfinished';

/** An image on Steam's CDN, optionally with a double-resolution version. */
export interface ArtImage {
  src: string;
  src2x?: string;
}

/** Artwork Steam publishes for a game. Any of it can be missing. */
export interface GameArt {
  /** Vertical store capsule (374×448). Fills a square tile with the logo intact. */
  capsule?: ArtImage;
  /** Library cover (2:3). */
  library?: ArtImage;
  /** Store header (460×215). */
  header?: ArtImage;
  /** Logo-free library banner (1920×620). */
  hero?: ArtImage;
  /** 32×32 app icon. */
  icon?: string;
}

export interface SteamProfile {
  steamId: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface Game {
  appId: number;
  /** The name exactly as Steam reports it. */
  name: string;
  /** The name tidied up for display. */
  title: string;
  playtimeMinutes: number;
  /** Unix time in milliseconds, or null if never played. */
  lastPlayedAt: number | null;
  status: GameStatus;
  finishedAt: string | null;
  art: GameArt;
}

export interface LibraryResponse {
  connected: boolean;
  profile: SteamProfile | null;
  lastSyncAt: string | null;
  autoSync: boolean;
  games: Game[];
}

export interface SettingsResponse {
  connected: boolean;
  profile: SteamProfile | null;
  /** Last four characters of the saved API key, masked. */
  apiKeyHint: string | null;
  autoSync: boolean;
  lastSyncAt: string | null;
  dataFile: string;
}

/** A Steam account that has signed in on this computer. */
export interface DetectedAccount {
  steamId: string;
  personaName: string;
  mostRecent: boolean;
}

export interface ConnectRequest {
  /** Omit to keep the saved key. */
  apiKey?: string;
  profile: string;
}

export type ErrorField = 'apiKey' | 'profile';

export interface ApiErrorBody {
  message: string;
  field?: ErrorField;
}
