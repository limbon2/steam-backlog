import { useMemo, useState, type SyntheticEvent } from 'react';
import type { GameArt } from '../../shared/types';
import { coverSources } from '../lib/art';
import { cx } from '../lib/cx';
import styles from './CoverArt.module.css';

export function markLoaded(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.dataset.loaded = 'true';
}

/** A game's square tile art. Falls back through Steam's images, then to the title. */
export function CoverArt({ art, title, className }: { art: GameArt; title: string; className?: string }) {
  const sources = useMemo(() => coverSources(art), [art]);
  const [broken, setBroken] = useState<readonly string[]>([]);
  const source = sources.find((s) => !broken.includes(s.src));
  const skip = () => source && setBroken((list) => [...list, source.src]);

  return (
    <div className={cx(styles.frame, className)}>
      {!source ? (
        <div className={styles.titleTile}>
          {art.icon && <img className={styles.icon} src={art.icon} alt="" />}
          <span>{title}</span>
        </div>
      ) : source.mode === 'cover' ? (
        <img
          key={source.src}
          className={styles.cover}
          src={source.src}
          srcSet={source.srcSet}
          sizes={source.sizes}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={markLoaded}
          onError={skip}
        />
      ) : (
        <>
          <img key={`${source.src}#backdrop`} className={styles.backdrop} src={source.src} alt="" loading="lazy" />
          <img
            key={source.src}
            className={styles.contain}
            src={source.src}
            srcSet={source.srcSet}
            sizes={source.sizes}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={markLoaded}
            onError={skip}
          />
        </>
      )}
    </div>
  );
}
