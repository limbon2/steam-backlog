import { Navigate, Route, Routes } from 'react-router';
import styles from './App.module.css';
import { TopBar } from './components/TopBar';
import { useAutoSync } from './hooks/useLibrary';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

export function App() {
  useAutoSync();

  return (
    <div className={styles.app}>
      <TopBar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
