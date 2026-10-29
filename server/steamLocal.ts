import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DetectedAccount } from '../shared/types';

export interface VdfNode {
  [key: string]: string | VdfNode;
}

/** Parses Valve's text KeyValues format, which Steam uses for loginusers.vdf. */
export function parseVdf(text: string): VdfNode {
  let pos = 0;

  const skipSpaceAndComments = () => {
    while (pos < text.length) {
      if (/\s/.test(text[pos])) pos++;
      else if (text.startsWith('//', pos)) {
        const end = text.indexOf('\n', pos);
        pos = end === -1 ? text.length : end + 1;
      } else break;
    }
  };

  const readString = (): string => {
    if (text[pos] !== '"') {
      const start = pos;
      while (pos < text.length && !/[\s{}"]/.test(text[pos])) pos++;
      return text.slice(start, pos);
    }
    pos++;
    let out = '';
    while (pos < text.length && text[pos] !== '"') {
      if (text[pos] === '\\' && pos + 1 < text.length) {
        const escaped = text[pos + 1];
        out += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
        pos += 2;
      } else {
        out += text[pos++];
      }
    }
    pos++;
    return out;
  };

  const readObject = (): VdfNode => {
    const node: VdfNode = {};
    for (;;) {
      skipSpaceAndComments();
      if (pos >= text.length) return node;
      if (text[pos] === '}') {
        pos++;
        return node;
      }
      const key = readString();
      skipSpaceAndComments();
      if (text[pos] === '{') {
        pos++;
        node[key] = readObject();
      } else {
        node[key] = readString();
      }
    }
  };

  return readObject();
}

function child(node: VdfNode, key: string): string | VdfNode | undefined {
  const match = Object.keys(node).find((k) => k.toLowerCase() === key.toLowerCase());
  return match === undefined ? undefined : node[match];
}

/** Reads the accounts in loginusers.vdf, most recently used first. */
export function parseLoginUsers(text: string): DetectedAccount[] {
  const users = child(parseVdf(text), 'users');
  if (!users || typeof users === 'string') return [];

  return Object.entries(users)
    .flatMap(([steamId, entry]) => {
      if (typeof entry === 'string' || !/^7656\d{13}$/.test(steamId)) return [];
      const field = (key: string) => {
        const value = child(entry, key);
        return typeof value === 'string' ? value : '';
      };
      return [
        {
          steamId,
          personaName: field('PersonaName') || steamId,
          mostRecent: field('MostRecent') === '1',
          timestamp: Number(field('Timestamp')) || 0,
        },
      ];
    })
    .sort((a, b) => Number(b.mostRecent) - Number(a.mostRecent) || b.timestamp - a.timestamp)
    .map(({ steamId, personaName, mostRecent }) => ({ steamId, personaName, mostRecent }));
}

const execFileAsync = promisify(execFile);

async function steamFolders(): Promise<string[]> {
  if (process.platform === 'win32') {
    const folders: string[] = [];
    for (const key of ['HKCU\\Software\\Valve\\Steam', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam']) {
      try {
        const { stdout } = await execFileAsync('reg', ['query', key], { windowsHide: true });
        const match = stdout.match(/^\s*(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)$/im);
        if (match) folders.push(path.normalize(match[1].trim()));
      } catch {
        // Key not present.
      }
    }
    return [...folders, 'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];
  }
  if (process.platform === 'darwin') return [path.join(os.homedir(), 'Library', 'Application Support', 'Steam')];
  return [path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam')];
}

/** Finds the Steam accounts that have signed in to the Steam client on this computer. */
export async function detectSteamAccounts(): Promise<DetectedAccount[]> {
  for (const folder of await steamFolders()) {
    try {
      return parseLoginUsers(await readFile(path.join(folder, 'config', 'loginusers.vdf'), 'utf8'));
    } catch {
      // Not installed here; try the next folder.
    }
  }
  return [];
}
