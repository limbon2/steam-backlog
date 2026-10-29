import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { isValidApiKey, parseProfileInput } from '../../shared/steamInput';
import type { ErrorField } from '../../shared/types';
import { api, ApiError } from '../api';
import { libraryKey, settingsKey } from '../hooks/useLibrary';
import { cx } from '../lib/cx';
import styles from './ConnectSteam.module.css';
import { SteamIcon } from './icons';
import ui from './ui.module.css';

const OTHER_ACCOUNT = 'other';
const PROFILE_HELP = 'Enter a Steam profile URL, a custom URL name or a SteamID64.';
const KEY_HELP = 'A Steam Web API key is 32 characters long, using 0–9 and A–F.';

type Errors = Partial<Record<ErrorField | 'form', string>>;

/** Connects a Steam account: pick the account signed in on this PC (or enter one) and paste an API key. */
export function ConnectSteam({ standalone = false }: { standalone?: boolean }) {
  const id = useId();
  const queryClient = useQueryClient();
  const detected = useQuery({ queryKey: ['steam-accounts'], queryFn: api.detectAccounts, staleTime: Infinity });
  const accounts = detected.data?.accounts ?? [];

  const [choice, setChoice] = useState<string | null>(null);
  const [profile, setProfile] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const selected = choice ?? accounts[0]?.steamId ?? OTHER_ACCOUNT;
  const profileInput = selected === OTHER_ACCOUNT ? profile : selected;

  const connect = useMutation({
    mutationFn: api.connect,
    onSuccess: (library) => {
      queryClient.setQueryData(libraryKey, library);
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err) => setErrors(err instanceof ApiError && err.field ? { [err.field]: err.message } : { form: err.message }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (!parseProfileInput(profileInput)) found.profile = PROFILE_HELP;
    if (!isValidApiKey(apiKey)) found.apiKey = KEY_HELP;
    setErrors(found);
    if (!found.profile && !found.apiKey) connect.mutate({ apiKey: apiKey.trim(), profile: profileInput.trim() });
  };

  const form = (
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.fieldset} disabled={connect.isPending}>
        <legend className={ui.label}>Steam account</legend>
        {detected.isPending && <p className={ui.hint}>Looking for Steam accounts on this PC…</p>}
        {accounts.map((account) => (
          <label key={account.steamId} className={cx(styles.option, selected === account.steamId && styles.selected)}>
            <input
              type="radio"
              name={`${id}-account`}
              checked={selected === account.steamId}
              onChange={() => setChoice(account.steamId)}
            />
            <SteamIcon size={24} className={styles.optionIcon} />
            <span className={styles.optionText}>
              <strong>{account.personaName}</strong>
              <span>Signed in on this PC · {account.steamId}</span>
            </span>
          </label>
        ))}
        {accounts.length > 0 && (
          <label className={cx(styles.option, selected === OTHER_ACCOUNT && styles.selected)}>
            <input
              type="radio"
              name={`${id}-account`}
              checked={selected === OTHER_ACCOUNT}
              onChange={() => setChoice(OTHER_ACCOUNT)}
            />
            <span className={styles.optionText}>
              <strong>A different account</strong>
            </span>
          </label>
        )}
        {!detected.isPending && selected === OTHER_ACCOUNT && (
          <input
            className={cx(ui.input, errors.profile && ui.inputError)}
            value={profile}
            placeholder="steamcommunity.com/id/yourname"
            aria-label="Steam profile URL, custom URL name or SteamID64"
            aria-invalid={Boolean(errors.profile)}
            aria-describedby={errors.profile ? `${id}-profile-error` : undefined}
            autoFocus={accounts.length > 0}
            spellCheck={false}
            onChange={(event) => setProfile(event.target.value)}
          />
        )}
        {!detected.isPending && accounts.length === 0 && (
          <p className={ui.hint}>Paste your profile link from Steam, or your custom URL name.</p>
        )}
        {errors.profile && (
          <p id={`${id}-profile-error`} className={ui.error}>
            {errors.profile}
          </p>
        )}
      </fieldset>

      <div className={ui.field}>
        <label htmlFor={`${id}-key`} className={ui.label}>
          Steam Web API key
        </label>
        <div className={styles.keyField}>
          <input
            id={`${id}-key`}
            type={showKey ? 'text' : 'password'}
            className={cx(ui.input, styles.keyInput, errors.apiKey && ui.inputError)}
            value={apiKey}
            placeholder="32 characters"
            autoComplete="off"
            spellCheck={false}
            disabled={connect.isPending}
            aria-invalid={Boolean(errors.apiKey)}
            aria-describedby={`${id}-key-help${errors.apiKey ? ` ${id}-key-error` : ''}`}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            onClick={() => setShowKey((shown) => !shown)}
          >
            {showKey ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {errors.apiKey && (
          <p id={`${id}-key-error`} className={ui.error}>
            {errors.apiKey}
          </p>
        )}
        <p id={`${id}-key-help`} className={ui.hint}>
          Get one at{' '}
          <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer">
            steamcommunity.com/dev/apikey
            <ExternalLink size={12} className={styles.external} aria-hidden />
          </a>
          : sign in, enter <code>localhost</code> as the domain name and copy the key. It&apos;s saved only on this
          computer.
        </p>
      </div>

      {errors.form && (
        <p className={ui.error} role="alert">
          {errors.form}
        </p>
      )}

      <button type="submit" className={cx(ui.button, ui.primary, styles.submit)} disabled={connect.isPending}>
        {connect.isPending ? (
          <>
            <span className={ui.spinner} aria-hidden />
            Fetching your games…
          </>
        ) : (
          <>
            <SteamIcon size={20} />
            Connect Steam
          </>
        )}
      </button>
    </form>
  );

  if (!standalone) return form;

  return (
    <section className={cx(ui.panel, styles.standalone)} aria-labelledby={`${id}-title`}>
      <div className={styles.badge}>
        <SteamIcon size={30} />
      </div>
      <h1 id={`${id}-title`} className={styles.title}>
        Connect your Steam library
      </h1>
      <p className={styles.lead}>
        Backlog reads your games and playtime from Steam, then you mark what you&apos;ve finished. Your marks stay on
        this computer.
      </p>
      {form}
    </section>
  );
}
