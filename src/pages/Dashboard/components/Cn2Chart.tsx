import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function Cn2Chart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);

  const timestamps = samples.map((s) => s.timestamp);
  const cn2Values = samples.map((s) => s.cn2);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 60 },
    xAxis: { type: 'category' as const, data: timestamps, show: true },
    yAxis: {
      type: 'value' as const,
      name: 'm⁻²/³',
      axisLabel: { formatter: (v: number) => v.toExponential(1) },
    },
    series: [
      {
        data: cn2Values,
        type: 'line' as const,
        smooth: true,
        lineStyle: { color: '#722ed1', width: 2 },
        showSymbol: false,
        areaStyle: { color: 'rgba(114, 46, 209, 0.1)' },
      },
    ],
    animation: false,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { value: number }[]) => {
        const v = params[0]?.value ?? 0;
        return `Cn²: ${v.toExponential(2)} m⁻²/³`;
      },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>📉 Cn² 折射率</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
