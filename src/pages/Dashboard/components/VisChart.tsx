import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function VisChart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);

  const timestamps = samples.map((s) => s.timestamp);
  const visValues = samples.map((s) => s.vis);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: timestamps, show: true },
    yAxis: { type: 'value' as const, name: 'km' },
    series: [
      {
        data: visValues,
        type: 'line' as const,
        smooth: true,
        lineStyle: { color: '#faad14', width: 2 },
        showSymbol: false,
        areaStyle: { color: 'rgba(250, 173, 20, 0.1)' },
      },
    ],
    animation: false,
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>📉 Vis 能见度</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
