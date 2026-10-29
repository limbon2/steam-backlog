/** Steam Web API keys are 32 hexadecimal characters. */
export function isValidApiKey(key: string): boolean {
  return /^[0-9a-f]{32}$/i.test(key.trim());
}

export type ProfileRef = { steamId: string } | { vanity: string };

const STEAM_ID = /^7656\d{13}$/;

/**
 * Accepts a SteamID64, a steamcommunity.com profile URL (`/profiles/<id>` or `/id/<name>`),
 * or a bare custom URL name.
 */
export function parseProfileInput(input: string): ProfileRef | null {
  const value = input.trim();
  if (!value) return null;
  if (STEAM_ID.test(value)) return { steamId: value };

  const url = value.match(/steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i);
  if (url) {
    const [, kind, part] = url;
    if (kind.toLowerCase() === 'profiles') return STEAM_ID.test(part) ? { steamId: part } : null;
    try {
      return { vanity: decodeURIComponent(part) };
    } catch {
      return null;
    }
  }

  return /^[\w-]{2,32}$/.test(value) ? { vanity: value } : null;
}
