import { describe, expect, it } from 'vitest';
import { coverSources, heroSources } from './art';

describe('coverSources', () => {
  it('tries the vertical capsule first, then shows the cover and header whole', () => {
    const sources = coverSources({
      capsule: { src: 'capsule.jpg', src2x: 'capsule_2x.jpg' },
      library: { src: 'library.jpg' },
      header: { src: 'header.jpg' },
      hero: { src: 'hero.jpg' },
    });
    expect(sources.map((s) => [s.mode, s.src])).toEqual([
      ['cover', 'capsule.jpg'],
      ['fill', 'library.jpg'],
      ['fill', 'header.jpg'],
    ]);
    expect(sources[0].srcSet).toBe('capsule.jpg 374w, capsule_2x.jpg 748w');
    expect(sources[1].srcSet).toBeUndefined();
  });

  it('is empty when Steam has no images', () => {
    expect(coverSources({ icon: 'icon.jpg' })).toEqual([]);
  });
});

describe('heroSources', () => {
  it('uses the library banner, then the header', () => {
    expect(heroSources({ hero: { src: 'hero.jpg', src2x: 'hero_2x.jpg' }, header: { src: 'header.jpg' } }).map((s) => s.src)).toEqual([
      'hero.jpg',
      'header.jpg',
    ]);
  });
});
