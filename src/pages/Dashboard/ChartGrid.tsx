import { WaveformChart } from './components/WaveformChart';
import { VisChart } from './components/VisChart';
import { Cn2Chart } from './components/Cn2Chart';
import { SixParamPlaceholder } from './components/SixParamPlaceholder';
import styles from './ChartGrid.module.css';

export function ChartGrid() {
  return (
    <div className={styles.grid}>
      <WaveformChart />
      <VisChart />
      <SixParamPlaceholder />
      <Cn2Chart />
    </div>
  );
}
