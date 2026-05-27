import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useWaveformStore } from '../../../stores/waveformStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function WaveformChart() {
  const { ref, width, height } = useContainerSize();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const uPlotInstance = useRef<uPlot | null>(null);
  const ch1Data = useWaveformStore((s) => s.ch1);
  const ch2Data = useWaveformStore((s) => s.ch2);

  useEffect(() => {
    if (!plotRef.current || width === 0 || height === 0) return;

    if (uPlotInstance.current) {
      uPlotInstance.current.destroy();
    }

    const opts: uPlot.Options = {
      width,
      height: height - 24,
      scales: { x: { time: false }, y: {} },
      series: [
        {},
        { stroke: '#1890ff', width: 1, label: 'CH1' },
        { stroke: '#52c41a', width: 1, label: 'CH2' },
      ],
      axes: [
        { stroke: 'var(--text-secondary)', grid: { stroke: 'rgba(128,128,128,0.1)' } },
        { stroke: 'var(--text-secondary)', grid: { stroke: 'rgba(128,128,128,0.1)' } },
      ],
      cursor: { show: true },
      legend: { show: true },
    };

    const plot = new uPlot(opts, [[], [], []], plotRef.current);
    uPlotInstance.current = plot;

    return () => {
      plot.destroy();
      uPlotInstance.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const plot = uPlotInstance.current;
    if (!plot) return;

    const xs = ch1Data.map((_, i) => i);
    const y1 = ch1Data.map((f) => f.data[0]);
    const y2 = ch2Data.map((f) => f.data[0]);

    plot.setData([xs, y1, y2]);
  }, [ch1Data, ch2Data]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>📈 双通道电压波形 (ch1/ch2)</div>
      <div className={styles.chartWrap} ref={ref}>
        <div ref={plotRef} />
      </div>
    </div>
  );
}
