import { ArrowUpDown, ChevronDown, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useIsSyncing, useSync } from '../hooks/useLibrary';
import { useNow } from '../hooks/useNow';
import { cx } from '../lib/cx';
import { formatCount, relativeTime } from '../lib/format';
import { FILTERS, SORTS, type Filter, type SortKey } from '../lib/library';
import styles from './LibraryControls.module.css';

export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={styles.search} role="search">
      <Search className={styles.searchIcon} size={22} aria-hidden />
      <input
        ref={input}
        type="search"
        value={value}
        placeholder="Search games"
        aria-label="Search games"
        aria-keyshortcuts="/"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
        >
          <X size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function FilterTabs({
  value,
  counts,
  onChange,
}: {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (filter: Filter) => void;
}) {
  return (
    <div className={styles.tabs} role="group" aria-label="Show games">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={styles.tab}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
          <span className={styles.count}>{formatCount(counts[key])}</span>
        </button>
      ))}
    </div>
  );
}

export function SortMenu({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  return (
    <label className={styles.sort}>
      <span className="visually-hidden">Sort by</span>
      <ArrowUpDown className={styles.sortIcon} size={18} aria-hidden />
      <select value={value} onChange={(event) => onChange(event.target.value as SortKey)}>
        {SORTS.map(({ key, label }) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.chevron} size={18} aria-hidden />
    </label>
  );
}

/** "Synced 5 minutes ago" with a button to sync now. */
export function SyncStatus({ lastSyncAt }: { lastSyncAt: string | null }) {
  const now = useNow();
  const syncing = useIsSyncing();
  const { mutate: sync } = useSync();

  return (
    <span className={styles.sync}>
      {syncing ? 'Syncing…' : lastSyncAt ? `Synced ${relativeTime(lastSyncAt, now)}` : 'Not synced yet'}
      <button
        type="button"
        className={styles.syncButton}
        disabled={syncing}
        aria-label="Sync with Steam now"
        title="Sync with Steam now"
        onClick={() => sync()}
      >
        <RefreshCw size={16} className={cx(syncing && styles.spinning)} aria-hidden />
      </button>
    </span>
  );
}
