import { cx } from '../lib/cx';
import styles from './Skeleton.module.css';

export function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your library">
      <div className={styles.header}>
        <div>
          <div className={cx(styles.block, styles.title)} />
          <div className={cx(styles.block, styles.subtitle)} />
        </div>
        <div className={cx(styles.block, styles.search)} />
      </div>
      <div className={cx(styles.block, styles.hero)} />
      <div className={cx(styles.block, styles.toolbar)} />
      <div className={styles.grid}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={cx(styles.block, styles.card)} />
        ))}
      </div>
    </div>
  );
}
