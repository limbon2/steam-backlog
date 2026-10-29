const TRADEMARKS = /[™®©]/g; // ™ ® ©

/** Words kept lowercase in titles unless they start a phrase. */
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'the',
  'to', 'vs', 'with',
]);

/** Two-letter words that are ordinary words, not acronyms. */
const SHORT_WORDS = new Set(['be', 'do', 'go', 'he', 'hi', 'if', 'is', 'it', 'me', 'my', 'no', 'oh', 'ok', 'so', 'up', 'us', 'we']);

/** All-caps words that should stay that way. */
const ACRONYMS = new Set([
  'AI', 'DLC', 'DOOM', 'FIFA', 'FPS', 'GOTY', 'GTA', 'HD', 'KOF', 'LEGO', 'MMO', 'NBA', 'NFL', 'NHL', 'NPC', 'OST',
  'PC', 'PES', 'RPG', 'RTS', 'SNK', 'TV', 'UFC', 'UFO', 'UI', 'USA', 'VR', 'WRC', 'WWE', 'XCOM',
]);

const ROMAN_NUMERAL = /^(?=[IVX])X{0,3}(IX|IV|V?I{0,3})$/;

/**
 * Tidies a Steam app name for display: drops ™/®/© and title-cases names Steam stores in
 * all caps (`ELDEN RING` → `Elden Ring`). Single-word names such as DOOM stay as they are.
 */
export function displayName(name: string): string {
  const clean = name.replace(TRADEMARKS, '').replace(/\s+/g, ' ').replace(/ ([:,])/g, '$1').trim();
  return isAllCaps(clean) ? titleCase(clean) : clean;
}

function isAllCaps(name: string): boolean {
  if (/\p{Ll}/u.test(name)) return false;
  const words = name.split(' ').filter((word) => (word.match(/\p{L}/gu)?.length ?? 0) >= 2);
  return words.length >= 2;
}

function titleCase(name: string): string {
  const tokens = name.split(' ');
  return tokens
    .map((token, i) => {
      const previous = tokens[i - 1];
      const startsPhrase = i === 0 || previous === '-' || /[:–—]$/.test(previous);
      return token
        .split('-')
        .map((part, j) => casePart(part, startsPhrase || j > 0))
        .join('-');
    })
    .join(' ');
}

function casePart(part: string, startsPhrase: boolean): string {
  const core = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!core) return part;
  // Numbers (2K25), dotted acronyms (S.T.A.L.K.E.R.), known acronyms and Roman numerals stay.
  if (/\d/.test(core) || /\p{L}\.\p{L}/u.test(core) || ACRONYMS.has(core) || ROMAN_NUMERAL.test(core)) return part;

  const lower = core.toLowerCase();
  if (SMALL_WORDS.has(lower)) return part.replace(core, startsPhrase ? capitalize(lower) : lower);
  if (core.length === 2 && !SHORT_WORDS.has(lower)) return part;
  return part.replace(core, capitalize(lower));
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
