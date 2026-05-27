import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useWaveformStore } from '../../../stores/waveformStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

/** Read a resolved CSS custom property value, falling back if not set. */
function getResolvedColor(varName: string, fallback: string): string {
  return getComputedStyle(document.body).getPropertyValue(varName).trim() || fallback;
}

export function WaveformChart() {
  const { ref, width, height } = useContainerSize();
  const plotDivRef = useRef<HTMLDivElement | null>(null);
  const uPlotInstance = useRef<uPlot | null>(null);
  const ch1Data = useWaveformStore((s) => s.ch1);
  const ch2Data = useWaveformStore((s) => s.ch2);

  // Bump this key when dark-theme class toggles on body, so we recreate
  // uPlot with freshly resolved CSS variable colours.
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey((k) => k + 1));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Detect what triggered the effect so we can choose the right strategy:
  //   size-only change  -> setSize (no destroy)
  //   theme change      -> destroy then recreate
  //   first mount       -> create
  const prevWidth = useRef(width);
  const prevHeight = useRef(height);
  const prevThemeKey = useRef(themeKey);

  // -- Create / resize / theme-recreate ---------------------------------
  useEffect(() => {
    if (width === 0 || height === 0 || !plotDivRef.current) return;

    const themeChanged = prevThemeKey.current !== themeKey;
    prevThemeKey.current = themeKey;
    prevWidth.current = width;
    prevHeight.current = height;

    // Theme switch — blow away the old canvas so we can pick up new colours.
    if (themeChanged && uPlotInstance.current) {
      uPlotInstance.current.destroy();
      uPlotInstance.current = null;
    }

    if (!uPlotInstance.current) {
      // Resolve CSS custom properties to concrete values for Canvas 2D.
      const textColor = getResolvedColor('--text-secondary', '#888');
      const gridColor = 'rgba(128,128,128,0.1)';

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
          { stroke: textColor, grid: { stroke: gridColor } },
          { stroke: textColor, grid: { stroke: gridColor } },
        ],
        cursor: { show: true },
        legend: { show: true },
      };

      uPlotInstance.current = new uPlot(opts, [[], [], []], plotDivRef.current);
    } else {
      // Size-only change — keep the same instance, just resize.
      uPlotInstance.current.setSize({ width, height: height - 24 });
    }
  }, [width, height, themeKey]);

  // -- Unmount cleanup (runs once, not on every dep change) --------------
  useEffect(() => {
    const instance = uPlotInstance;
    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);

  // -- Data update: show the latest frame's full 1000-point waveform ----
  useEffect(() => {
    const plot = uPlotInstance.current;
    if (!plot) return;

    const latestCh1 = ch1Data.length > 0 ? ch1Data[ch1Data.length - 1] : null;
    const latestCh2 = ch2Data.length > 0 ? ch2Data[ch2Data.length - 1] : null;

    if (latestCh1 && latestCh2) {
      const numPoints = latestCh1.data.length;
      const xs = Array.from({ length: numPoints }, (_, i) => i);
      const y1 = Array.from(latestCh1.data);
      const y2 = Array.from(latestCh2.data);
      plot.setData([xs, y1, y2]);
    }
  }, [ch1Data, ch2Data]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>📈 双通道电压波形 (ch1/ch2)</div>
      <div className={styles.chartWrap} ref={ref}>
        <div ref={plotDivRef} />
      </div>
    </div>
  );
}
