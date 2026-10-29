import { memo } from 'react';
import type { Game, GameStatus } from '../../shared/types';
import { cx } from '../lib/cx';
import { formatHours } from '../lib/format';
import { CoverArt } from './CoverArt';
import styles from './GameCard.module.css';
import { StatusIcon } from './icons';

export type ToggleStatus = (appId: number, status: GameStatus) => void;

export const GameCard = memo(function GameCard({ game, onToggle }: { game: Game; onToggle: ToggleStatus }) {
  const finished = game.status === 'finished';
  return (
    <article className={styles.card}>
      <CoverArt art={game.art} title={game.title} />
      <div className={styles.body}>
        <h3 className={styles.title} title={game.title}>
          {game.title}
        </h3>
        <p className={styles.hours}>{formatHours(game.playtimeMinutes)} played</p>
        <button
          type="button"
          className={cx(styles.status, finished && styles.finished)}
          aria-pressed={finished}
          aria-label={`${game.title} finished`}
          title={finished ? 'Mark as unfinished' : 'Mark as finished'}
          onClick={() => onToggle(game.appId, finished ? 'unfinished' : 'finished')}
        >
          <StatusIcon finished={finished} size={23} />
          {finished ? 'Finished' : 'Unfinished'}
        </button>
      </div>
    </article>
  );
});

export function GameGrid({ games, onToggle }: { games: Game[]; onToggle: ToggleStatus }) {
  return (
    <div className={styles.grid}>
      {games.map((game) => (
        <GameCard key={game.appId} game={game} onToggle={onToggle} />
      ))}
    </div>
  );
}
