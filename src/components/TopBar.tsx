import { ChartNoAxesColumn, Gamepad2, Settings, User } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { useLibrary } from '../hooks/useLibrary';
import { cx } from '../lib/cx';
import { Logo, SteamIcon } from './icons';
import styles from './TopBar.module.css';

const navClass = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

export function TopBar() {
  const { data } = useLibrary();
  const profile = data?.profile;

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <Logo size={34} />
          <span>Backlog</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navClass}>
            <Gamepad2 size={23} aria-hidden />
            <span>Library</span>
          </NavLink>
          <NavLink to="/stats" className={navClass}>
            <ChartNoAxesColumn size={21} strokeWidth={2.4} aria-hidden />
            <span>Stats</span>
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <Settings size={21} aria-hidden />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className={styles.account}>
          {data?.connected ? (
            <span className={styles.connected}>
              <SteamIcon size={27} />
              <span className={styles.connectionLabel}>Steam connected</span>
            </span>
          ) : data ? (
            <Link to="/settings" className={styles.disconnected}>
              <SteamIcon size={27} />
              <span className={styles.connectionLabel}>Connect Steam</span>
            </Link>
          ) : null}
          <span className={styles.divider} aria-hidden />
          <Link
            to="/settings"
            className={styles.avatar}
            aria-label={profile ? `${profile.name}: account settings` : 'Account settings'}
            title={profile?.name}
          >
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <User size={20} aria-hidden />}
          </Link>
        </div>
      </div>
    </header>
  );
}
