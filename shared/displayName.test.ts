import { describe, expect, it } from 'vitest';
import { displayName } from './displayName';

describe('displayName', () => {
  it.each([
    ['ELDEN RING', 'Elden Ring'],
    ['DARK SOULS™ III', 'Dark Souls III'],
    ['FINAL FANTASY VII REMAKE INTERGRADE', 'Final Fantasy VII Remake Intergrade'],
    ['MONSTER HUNTER: WORLD', 'Monster Hunter: World'],
    ['THE WITCHER 3: WILD HUNT', 'The Witcher 3: Wild Hunt'],
    ['GOD OF WAR', 'God of War'],
    ['A PLAGUE TALE: INNOCENCE', 'A Plague Tale: Innocence'],
    ["MARVEL'S SPIDER-MAN REMASTERED", "Marvel's Spider-Man Remastered"],
    ['DISCO ELYSIUM - THE FINAL CUT', 'Disco Elysium - The Final Cut'],
    ['S.T.A.L.K.E.R. 2: HEART OF CHORNOBYL', 'S.T.A.L.K.E.R. 2: Heart of Chornobyl'],
  ])('title-cases %j', (name, expected) => {
    expect(displayName(name)).toBe(expected);
  });

  it.each(['DOOM', 'XCOM 2', 'NBA 2K25', 'Hollow Knight', 'Disco Elysium - The Final Cut', 'FTL: Faster Than Light'])(
    'leaves %j alone',
    (name) => {
      expect(displayName(name)).toBe(name);
    },
  );

  it('drops trademark symbols', () => {
    expect(displayName('Call of Duty®: Black Ops II')).toBe('Call of Duty: Black Ops II');
    expect(displayName('Sid Meier’s Civilization® V')).toBe('Sid Meier’s Civilization V');
    expect(displayName('BioShock™ Infinite')).toBe('BioShock Infinite');
  });
});
