import { StatusControlBar } from './StatusControlBar';
import { ChartGrid } from './ChartGrid';
import styles from './dashboard.module.css';

export default function Dashboard() {
  return (
    <div className={styles.content}>
      <StatusControlBar />
      <ChartGrid />
    </div>
  );
}
