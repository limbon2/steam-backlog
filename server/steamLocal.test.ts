import { describe, expect, it } from 'vitest';
import { parseLoginUsers, parseVdf } from './steamLocal';

const LOGIN_USERS = `"users"
{
	"76561198000000001"
	{
		"AccountName"		"old_login"
		"PersonaName"		"Older \\"Quoted\\" Name"
		"MostRecent"		"0"
		"Timestamp"		"1600000000"
	}
	"76561198000000002"
	{
		"AccountName"		"main_login"
		"PersonaName"		"Main"
		"mostrecent"		"1"
		"Timestamp"		"1700000000"
	}
}
`;

describe('parseVdf', () => {
  it('reads nested objects and skips comments', () => {
    expect(parseVdf('// header\n"a" { "b" "1" "c" { "d" "2" } }')).toEqual({ a: { b: '1', c: { d: '2' } } });
  });

  it('reads unquoted tokens', () => {
    expect(parseVdf('root { key value }')).toEqual({ root: { key: 'value' } });
  });
});

describe('parseLoginUsers', () => {
  it('lists accounts with the most recent first', () => {
    expect(parseLoginUsers(LOGIN_USERS)).toEqual([
      { steamId: '76561198000000002', personaName: 'Main', mostRecent: true },
      { steamId: '76561198000000001', personaName: 'Older "Quoted" Name', mostRecent: false },
    ]);
  });

  it('returns nothing for unexpected content', () => {
    expect(parseLoginUsers('')).toEqual([]);
    expect(parseLoginUsers('"users" "oops"')).toEqual([]);
  });
});
