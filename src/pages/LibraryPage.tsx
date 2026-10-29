import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Game } from '../../shared/types';
import { ConnectSteam } from '../components/ConnectSteam';
import { GameGrid, type ToggleStatus } from '../components/GameCard';
import { HeroCard } from '../components/HeroCard';
import { FilterTabs, SearchInput, SortMenu, SyncStatus } from '../components/LibraryControls';
import { LibrarySkeleton } from '../components/Skeleton';
import ui from '../components/ui.module.css';
import { useLibrary, useSetStatus } from '../hooks/useLibrary';
import { cx } from '../lib/cx';
import { formatCount } from '../lib/format';
import { countByStatus, lastPlayedGame, parseFilter, parseSort, visibleGames, type Filter } from '../lib/library';
import styles from './LibraryPage.module.css';

const NO_GAMES: Game[] = [];

export function LibraryPage() {
  const { data, isPending, error, refetch } = useLibrary();
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('filter'));
  const sort = parseSort(params.get('sort'));
  const query = params.get('q') ?? '';

  const { mutate: setStatus } = useSetStatus();
  const toggle = useCallback<ToggleStatus>((appId, status) => setStatus({ appId, status }), [setStatus]);

  const games = data?.games ?? NO_GAMES;
  const counts = useMemo(() => countByStatus(games), [games]);
  const hero = useMemo(() => lastPlayedGame(games), [games]);
  const visible = useMemo(() => visibleGames(games, filter, query, sort), [games, filter, query, sort]);

  /** Keeps filter, sort and search in the URL, leaving defaults out. */
  const setParam = (key: string, value: string, defaultValue: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === defaultValue) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  if (isPending) return <LibrarySkeleton />;

  if (error) {
    return (
      <div className={styles.message}>
        <h1>Couldn&apos;t load your library</h1>
        <p>{error.message}</p>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data.connected) return <ConnectSteam standalone />;

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={ui.pageTitle}>Your library</h1>
          <p className={ui.pageSubtitle}>
            {formatCount(counts.all)} {counts.all === 1 ? 'game' : 'games'}
            <span className={ui.dot} aria-hidden>
              ·
            </span>
            <SyncStatus lastSyncAt={data.lastSyncAt} />
          </p>
        </div>
        <SearchInput value={query} onChange={(value) => setParam('q', value, '')} />
      </header>

      {hero && !query && <HeroCard key={hero.appId} game={hero} onToggle={toggle} />}

      <div className={styles.toolbar}>
        <FilterTabs value={filter} counts={counts} onChange={(value) => setParam('filter', value, 'all')} />
        <SortMenu value={sort} onChange={(value) => setParam('sort', value, 'recent')} />
      </div>

      {visible.length > 0 ? (
        <GameGrid games={visible} onToggle={toggle} />
      ) : (
        <div className={styles.empty}>
          {emptyMessage(games.length, filter, query)}
          {query && (
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setParam('q', '', '')}>
              Clear search
            </button>
          )}
        </div>
      )}
    </>
  );
}

function emptyMessage(total: number, filter: Filter, query: string): string {
  if (total === 0) return 'Steam didn’t return any games for this account yet.';
  if (query) return `No ${filter === 'all' ? '' : `${filter} `}games match “${query}”.`;
  if (filter === 'finished') return 'Nothing marked as finished yet. Mark a game finished and it shows up here.';
  return 'Every game in your library is finished. Nice work.';
}
