import { Check, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Game, GameArt } from '../../shared/types';
import { heroSources } from '../lib/art';
import { cx } from '../lib/cx';
import { formatHours } from '../lib/format';
import { markLoaded } from './CoverArt';
import type { ToggleStatus } from './GameCard';
import styles from './HeroCard.module.css';
import { StatusIcon } from './icons';

/** The "Last played" banner. */
export function HeroCard({ game, onToggle }: { game: Game; onToggle: ToggleStatus }) {
  const finished = game.status === 'finished';
  return (
    <section className={styles.hero} aria-labelledby="last-played">
      <HeroArt art={game.art} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Last played</p>
        <h2 id="last-played" className={styles.title}>
          {game.title}
        </h2>
        <p className={styles.hours}>{formatHours(game.playtimeMinutes)} played</p>
        <p className={cx(styles.status, finished && styles.finished)}>
          <StatusIcon finished={finished} size={25} />
          {finished ? 'Finished' : 'Unfinished'}
        </p>
        <button
          type="button"
          className={cx(styles.action, finished && styles.secondary)}
          onClick={() => onToggle(game.appId, finished ? 'unfinished' : 'finished')}
        >
          {finished ? <RotateCcw size={20} aria-hidden /> : <Check size={24} strokeWidth={2.75} aria-hidden />}
          {finished ? 'Mark as unfinished' : 'Mark as finished'}
        </button>
      </div>
    </section>
  );
}

function HeroArt({ art }: { art: GameArt }) {
  const sources = useMemo(() => heroSources(art), [art]);
  const [broken, setBroken] = useState<readonly string[]>([]);
  const source = sources.find((s) => !broken.includes(s.src));
  if (!source) return null;
  return (
    <img
      key={source.src}
      className={styles.art}
      src={source.src}
      srcSet={source.srcSet}
      sizes={source.sizes}
      alt=""
      decoding="async"
      onLoad={markLoaded}
      onError={() => setBroken((list) => [...list, source.src])}
    />
  );
}
