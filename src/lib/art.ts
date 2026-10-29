import type { ArtImage, GameArt } from '../../shared/types';

export interface ArtSource {
  /** `cover` crops the image to fill the frame; `fill` shows it whole over a blurred copy. */
  mode: 'cover' | 'fill';
  src: string;
  srcSet?: string;
  sizes: string;
}

function source(mode: ArtSource['mode'], image: ArtImage, width: number, sizes: string): ArtSource {
  return {
    mode,
    src: image.src,
    srcSet: image.src2x ? `${image.src} ${width}w, ${image.src2x} ${width * 2}w` : undefined,
    sizes,
  };
}

/**
 * Images to try for a square tile, best first. The vertical capsule crops to a square with the
 * logo intact; the 2:3 library cover and the wide header would lose their logos to a crop, so
 * they're shown whole instead.
 */
export function coverSources(art: GameArt): ArtSource[] {
  const sources: ArtSource[] = [];
  if (art.capsule) sources.push(source('cover', art.capsule, 374, '(max-width: 640px) 50vw, 300px'));
  if (art.library) sources.push(source('fill', art.library, 300, '(max-width: 640px) 34vw, 200px'));
  if (art.header) sources.push(source('fill', art.header, 460, '(max-width: 640px) 50vw, 300px'));
  return sources;
}

/** Images to try for the wide "Last played" banner, best first. */
export function heroSources(art: GameArt): ArtSource[] {
  const sources: ArtSource[] = [];
  if (art.hero) sources.push(source('cover', art.hero, 1920, '(max-width: 720px) 100vw, 1200px'));
  if (art.header) sources.push(source('cover', art.header, 460, '(max-width: 720px) 100vw, 1200px'));
  return sources;
}
