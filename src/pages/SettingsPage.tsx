import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, KeyRound, LogOut, RefreshCw } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { isValidApiKey } from '../../shared/steamInput';
import type { LibraryResponse, SettingsResponse, SteamProfile } from '../../shared/types';
import { api } from '../api';
import { ConnectSteam } from '../components/ConnectSteam';
import { useToast } from '../components/Toast';
import ui from '../components/ui.module.css';
import { libraryKey, settingsKey, useIsSyncing, useSync } from '../hooks/useLibrary';
import { useNow } from '../hooks/useNow';
import { cx } from '../lib/cx';
import { relativeTime } from '../lib/format';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const settings = useQuery({ queryKey: settingsKey, queryFn: api.settings });

  return (
    <div className={styles.page}>
      <h1 className={ui.pageTitle}>Settings</h1>
      {settings.isPending ? (
        <p className={styles.muted}>Loading…</p>
      ) : settings.error ? (
        <p className={ui.error}>{settings.error.message}</p>
      ) : (
        <>
          <section className={cx(ui.panel, styles.section)} aria-labelledby="settings-steam">
            <h2 id="settings-steam" className={ui.sectionTitle}>
              Steam account
            </h2>
            {settings.data.profile ? (
              <Account profile={settings.data.profile} apiKeyHint={settings.data.apiKeyHint} />
            ) : (
              <>
                <p className={styles.muted}>Connect your account to load your games.</p>
                <ConnectSteam />
              </>
            )}
          </section>
          {settings.data.connected && <SyncSettings settings={settings.data} />}
          <section className={cx(ui.panel, styles.section)} aria-labelledby="settings-data">
            <h2 id="settings-data" className={ui.sectionTitle}>
              Your data
            </h2>
            <p className={styles.muted}>
              Your finished marks, Steam connection and artwork links are saved in{' '}
              <code className={styles.path}>{settings.data.dataFile}</code>. Back up that file to keep your marks.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function useApplyLibrary() {
  const queryClient = useQueryClient();
  return (library: LibraryResponse) => {
    queryClient.setQueryData(libraryKey, library);
    void queryClient.invalidateQueries({ queryKey: settingsKey });
  };
}

function Account({ profile, apiKeyHint }: { profile: SteamProfile; apiKeyHint: string | null }) {
  const [mode, setMode] = useState<'idle' | 'changeKey' | 'confirmDisconnect'>('idle');
  const applyLibrary = useApplyLibrary();
  const toast = useToast();
  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: applyLibrary,
    onError: (err) => toast(err.message, 'error'),
  });

  return (
    <>
      <div className={styles.profile}>
        {profile.avatarUrl && <img className={styles.avatar} src={profile.avatarUrl} alt="" />}
        <div className={styles.profileText}>
          <p className={styles.name}>{profile.name}</p>
          <p className={styles.muted}>SteamID {profile.steamId}</p>
          <a className={styles.link} href={profile.profileUrl} target="_blank" rel="noreferrer">
            Open Steam profile
            <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </div>

      <p className={styles.keyLine}>
        <span className={styles.muted}>API key</span>
        <code className={styles.path}>{apiKeyHint}</code>
      </p>

      {mode === 'changeKey' ? (
        <ChangeKeyForm steamId={profile.steamId} onDone={() => setMode('idle')} />
      ) : mode === 'confirmDisconnect' ? (
        <div className={styles.confirm} role="group" aria-label="Confirm disconnect">
          <p>Disconnect Steam? Your finished marks stay saved and come back when you reconnect.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={cx(ui.button, ui.danger)}
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              <LogOut size={18} aria-hidden />
              Disconnect
            </button>
            <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={cx(ui.button, ui.secondary)} onClick={() => setMode('changeKey')}>
            <KeyRound size={18} aria-hidden />
            Change API key
          </button>
          <button type="button" className={cx(ui.button, ui.danger)} onClick={() => setMode('confirmDisconnect')}>
            <LogOut size={18} aria-hidden />
            Disconnect
          </button>
        </div>
      )}
    </>
  );
}

function ChangeKeyForm({ steamId, onDone }: { steamId: string; onDone: () => void }) {
  const id = useId();
  const toast = useToast();
  const applyLibrary = useApplyLibrary();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: api.connect,
    onSuccess: (library) => {
      applyLibrary(library);
      toast('API key updated.');
      onDone();
    },
    onError: (err) => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidApiKey(apiKey)) {
      setError('A Steam Web API key is 32 characters long, using 0–9 and A–F.');
      return;
    }
    setError(null);
    save.mutate({ apiKey: apiKey.trim(), profile: steamId });
  };

  return (
    <form className={styles.keyForm} onSubmit={submit} noValidate>
      <label htmlFor={`${id}-key`} className={ui.label}>
        New API key
      </label>
      <input
        id={`${id}-key`}
        type="password"
        className={cx(ui.input, styles.mono, error && ui.inputError)}
        value={apiKey}
        placeholder="32 characters"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setApiKey(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className={ui.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={cx(ui.button, ui.primary)} disabled={save.isPending}>
          {save.isPending ? 'Checking with Steam…' : 'Save key'}
        </button>
        <button type="button" className={cx(ui.button, ui.secondary)} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SyncSettings({ settings }: { settings: SettingsResponse }) {
  const id = useId();
  const now = useNow();
  const syncing = useIsSyncing();
  const { mutate: sync } = useSync();
  const queryClient = useQueryClient();
  const toast = useToast();
  const update = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKey, next);
      queryClient.setQueryData<LibraryResponse>(libraryKey, (library) => library && { ...library, autoSync: next.autoSync });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  return (
    <section className={cx(ui.panel, styles.section)} aria-labelledby="settings-sync">
      <h2 id="settings-sync" className={ui.sectionTitle}>
        Sync
      </h2>
      <div className={styles.row}>
        <p className={styles.muted}>
          {syncing
            ? 'Syncing with Steam…'
            : settings.lastSyncAt
              ? `Last synced ${relativeTime(settings.lastSyncAt, now)}.`
              : 'Not synced yet.'}
        </p>
        <button type="button" className={cx(ui.button, ui.secondary)} disabled={syncing} onClick={() => sync()}>
          <RefreshCw size={18} className={cx(syncing && styles.spinning)} aria-hidden />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <label className={styles.switchRow}>
        <span className={styles.switchText}>
          <span id={`${id}-label`} className={styles.switchLabel}>
            Sync when the app opens
          </span>
          <span id={`${id}-hint`} className={styles.muted}>
            Only when the last sync was more than 15 minutes ago.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          className={styles.switch}
          checked={settings.autoSync}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ autoSync: event.target.checked })}
        />
      </label>
    </section>
  );
}
