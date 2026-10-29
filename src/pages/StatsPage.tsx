import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ConnectSteam } from '../components/ConnectSteam';
import { CoverArt } from '../components/CoverArt';
import { StatusIcon } from '../components/icons';
import { SyncStatus } from '../components/LibraryControls';
import ui from '../components/ui.module.css';
import { useLibrary } from '../hooks/useLibrary';
import { cx } from '../lib/cx';
import { formatCount, formatHours, formatWholeHours } from '../lib/format';
import { computeStats, percent, type LibraryStats } from '../lib/stats';
import styles from './StatsPage.module.css';

export function StatsPage() {
  const { data, isPending, error } = useLibrary();
  const stats = useMemo(() => (data ? computeStats(data.games, new Date()) : null), [data]);

  if (isPending) return <p className={styles.status}>Loading your stats…</p>;
  if (error) return <p className={styles.status}>Couldn&apos;t load your library. {error.message}</p>;
  if (!data.connected || !stats) return <ConnectSteam standalone />;

  return (
    <>
      <header className={styles.header}>
        <h1 className={ui.pageTitle}>Stats</h1>
        <p className={ui.pageSubtitle}>
          Across {formatCount(stats.total)} {stats.total === 1 ? 'game' : 'games'}
          <span className={ui.dot} aria-hidden>
            ·
          </span>
          <SyncStatus lastSyncAt={data.lastSyncAt} />
        </p>
      </header>

      <div className={styles.tiles}>
        <Tile label="Games" value={formatCount(stats.total)} />
        <Tile label="Finished" value={formatCount(stats.finished)} note={`${percent(stats.finished, stats.total)} of your library`} />
        <Tile label="Unfinished" value={formatCount(stats.unfinished)} note={`${percent(stats.unfinished, stats.total)} of your library`} />
        <Tile label="Hours played" value={formatWholeHours(stats.totalMinutes)} note="Across all games" />
        <Tile label="Never played" value={formatCount(stats.neverPlayed)} note={`${percent(stats.neverPlayed, stats.total)} of your library`} />
      </div>

      <div className={styles.panels}>
        <Completion stats={stats} />
        <PlaytimeChart stats={stats} />
        <FinishedByMonth stats={stats} />
        <MostPlayed stats={stats} />
      </div>
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cx(ui.panel, styles.tile)}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      {note && <p className={styles.tileNote}>{note}</p>}
    </div>
  );
}

function Panel({
  title,
  caption,
  className,
  children,
}: {
  title: string;
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx(ui.panel, styles.panel, className)}>
      <h2 className={ui.sectionTitle}>{title}</h2>
      {caption && <p className={styles.caption}>{caption}</p>}
      {children}
    </section>
  );
}

function Completion({ stats }: { stats: LibraryStats }) {
  return (
    <Panel title="Completion" caption="How much of your library you've marked as finished.">
      <Meter
        label="By games"
        detail={`${formatCount(stats.finished)} of ${formatCount(stats.total)} games`}
        part={stats.finished}
        whole={stats.total}
      />
      <Meter
        label="By playtime"
        detail={`${formatWholeHours(stats.finishedMinutes)} of ${formatWholeHours(stats.totalMinutes)} in finished games`}
        part={stats.finishedMinutes}
        whole={stats.totalMinutes}
      />
    </Panel>
  );
}

function Meter({ label, detail, part, whole }: { label: string; detail: string; part: number; whole: number }) {
  const share = whole > 0 ? part / whole : 0;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHeader}>
        <span className={styles.meterLabel}>
          <StatusIcon finished size={18} />
          {label}
        </span>
        <span className={styles.meterValue}>{percent(part, whole)}</span>
      </div>
      <div
        className={styles.meterTrack}
        role="meter"
        aria-label={`${label}: finished`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div className={styles.meterFill} style={{ width: `${share * 100}%` }} />
      </div>
      <p className={styles.meterDetail}>{detail}</p>
    </div>
  );
}

/** Columns with every value labelled on its cap; a hidden table carries the same data for screen readers. */
function ColumnChart({
  columns,
  color,
  caption,
}: {
  columns: { key: string; label: string; sublabel?: string; value: number; tip: string }[];
  color: string;
  caption: string;
}) {
  const max = Math.max(1, ...columns.map((column) => column.value));
  // Every axis label gets the same number of lines so the baselines line up.
  const hasSublabels = columns.some((column) => column.sublabel);
  return (
    <>
      <div className={styles.columns} style={{ '--mark': color } as CSSProperties} aria-hidden>
        {columns.map((column) => (
          <div key={column.key} className={styles.column}>
            <div className={styles.plot}>
              {column.value > 0 && <span className={styles.capLabel}>{formatCount(column.value)}</span>}
              <div className={styles.bar} style={{ height: `${(column.value / max) * 100}%` }} />
              <span className={styles.tip}>
                <strong>{formatCount(column.value)}</strong> {column.tip}
              </span>
            </div>
            <span className={styles.axisLabel}>
              {column.label}
              {hasSublabels && <span className={styles.axisSublabel}>{column.sublabel ?? ' '}</span>}
            </span>
          </div>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <tbody>
          {columns.map((column) => (
            <tr key={column.key}>
              <th scope="row">
                {column.label} {column.sublabel}
              </th>
              <td>{column.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PlaytimeChart({ stats }: { stats: LibraryStats }) {
  return (
    <Panel title="Playtime" caption="How many games you've played for how long.">
      <ColumnChart
        caption="Games by hours played"
        color="var(--accent)"
        columns={stats.buckets.map((bucket) => ({
          key: bucket.label,
          label: bucket.label,
          value: bucket.count,
          tip: `${bucket.count === 1 ? 'game' : 'games'} · ${formatCount(bucket.finished)} finished`,
        }))}
      />
    </Panel>
  );
}

function FinishedByMonth({ stats }: { stats: LibraryStats }) {
  const currentYear = new Date().getFullYear();
  return (
    <Panel
      title="Finished per month"
      caption="Games you marked as finished in Backlog over the last 12 months."
      className={styles.wide}
    >
      <ColumnChart
        caption="Games finished per month"
        color="var(--success)"
        columns={stats.finishedByMonth.map((month, i) => ({
          key: month.key,
          label: month.label,
          sublabel: i === 0 || month.label === 'Jan' ? String(month.year) : undefined,
          value: month.count,
          tip: `finished in ${month.label} ${month.year === currentYear ? '' : month.year}`.trim(),
        }))}
      />
    </Panel>
  );
}

function MostPlayed({ stats }: { stats: LibraryStats }) {
  const max = stats.mostPlayed[0]?.playtimeMinutes ?? 1;
  return (
    <Panel title="Most played" caption="Your ten games with the most hours." className={styles.wide}>
      {stats.mostPlayed.length === 0 ? (
        <p className={styles.caption}>No playtime recorded yet.</p>
      ) : (
        <ol className={styles.bars}>
          {stats.mostPlayed.map((game) => {
            const finished = game.status === 'finished';
            return (
              <li key={game.appId} className={styles.barRow}>
                <CoverArt art={game.art} title={game.title} className={styles.thumb} />
                <span className={styles.barName}>
                  <span className={styles.barTitle} title={game.title}>
                    {game.title}
                  </span>
                  <StatusIcon finished={finished} size={16} className={styles.barStatus} />
                  <span className="visually-hidden">{finished ? '(finished)' : '(unfinished)'}</span>
                </span>
                <span className={styles.barTrack}>
                  <span className={styles.hbar} style={{ '--share': game.playtimeMinutes / max } as CSSProperties} />
                  <span className={styles.barValue}>{formatHours(game.playtimeMinutes)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
