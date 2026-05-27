import { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function VisChart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);
  const chartRef = useRef<ReactECharts>(null);

  const timestamps = samples.map((s) => s.utc.slice(11, 19));
  const visValues = samples.map((s) => s.vis);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: timestamps, axisLine: { show: false }, splitLine: { show: false }, boundaryGap: false, axisLabel: { interval: 0 } },
    yAxis: { type: 'value' as const, name: 'km', axisLine: { show: false } },
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
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { value: number }[]) => {
        const v = params[0]?.value ?? 0;
        return `Vis: ${v.toFixed(2)} km`;
      },
    },
    dataZoom: [{ type: 'inside' as const }],
  };

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || samples.length === 0) return;
    const total = samples.length;
    const startIdx = Math.max(0, total - 5);
    instance.dispatchAction({
      type: 'dataZoom',
      startValue: startIdx,
      endValue: total - 1,
    });
  }, [samples.length]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>📉 Vis 能见度</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts ref={chartRef} option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
