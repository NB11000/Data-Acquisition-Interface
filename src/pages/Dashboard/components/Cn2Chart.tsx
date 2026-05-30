import { useLayoutEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function Cn2Chart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);
  const chartRef = useRef<ReactECharts>(null);

  const timestamps = samples.map((s) => s.utc.slice(11, 19));
  const cn2Values = samples.map((s) => s.cn2);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 60 },
    xAxis: { type: 'category' as const, data: timestamps, axisLine: { show: false }, splitLine: { show: false }, boundaryGap: false, axisLabel: { interval: 0 } },
    yAxis: {
      type: 'value' as const,
      name: 'm⁻²/³',
      axisLabel: { formatter: (v: number) => v.toExponential(1) },
      axisLine: { show: false },
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
    dataZoom: [{ type: 'inside' as const }],
  };

  useLayoutEffect(() => {
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
      <div className={styles.title}>📉 Cn² 折射率</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts ref={chartRef} option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
