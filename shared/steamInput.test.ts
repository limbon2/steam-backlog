import { describe, expect, it } from 'vitest';
import { isValidApiKey, parseProfileInput } from './steamInput';

describe('parseProfileInput', () => {
  it.each([
    ['76561198000000000', { steamId: '76561198000000000' }],
    ['  76561198000000000  ', { steamId: '76561198000000000' }],
    ['https://steamcommunity.com/profiles/76561198000000000/', { steamId: '76561198000000000' }],
    ['steamcommunity.com/id/gaben', { vanity: 'gaben' }],
    ['https://steamcommunity.com/id/some_name/games/?tab=all', { vanity: 'some_name' }],
    ['gaben', { vanity: 'gaben' }],
  ])('reads %j', (input, expected) => {
    expect(parseProfileInput(input)).toEqual(expected);
  });

  it.each(['', '   ', 'https://steamcommunity.com/profiles/123', 'not a name!', 'x', 'steamcommunity.com/id/x%E0'])(
    'rejects %j',
    (input) => {
      expect(parseProfileInput(input)).toBeNull();
    },
  );
});

describe('isValidApiKey', () => {
  it('accepts 32 hex characters in either case', () => {
    expect(isValidApiKey('0123456789abcdef0123456789ABCDEF')).toBe(true);
    expect(isValidApiKey(' 0123456789abcdef0123456789abcdef ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidApiKey('')).toBe(false);
    expect(isValidApiKey('0123456789abcdef')).toBe(false);
    expect(isValidApiKey('0123456789abcdef0123456789abcdeg')).toBe(false);
  });
});
