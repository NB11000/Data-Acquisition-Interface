import { WaveformChart } from './components/WaveformChart';
import { VisChart } from './components/VisChart';
import { Cn2Chart } from './components/Cn2Chart';
import { SixParamPlaceholder } from './components/SixParamPlaceholder';
import { ChartErrorBoundary } from '../../components/ErrorBoundary';
import styles from './ChartGrid.module.css';

export function ChartGrid() {
  return (
    <div className={styles.grid}>
      <ChartErrorBoundary title="波形图加载失败">
        <WaveformChart />
      </ChartErrorBoundary>
      <ChartErrorBoundary title="能见度图表加载失败">
        <VisChart />
      </ChartErrorBoundary>
      <SixParamPlaceholder />
      <ChartErrorBoundary title="折射率图表加载失败">
        <Cn2Chart />
      </ChartErrorBoundary>
    </div>
  );
}
