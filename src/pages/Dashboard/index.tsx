import { StatusControlBar } from './StatusControlBar';
import { ChartGrid } from './ChartGrid';
import { useDeviceStore } from '../../stores/deviceStore';
import { useServerStore } from '../../stores/serverStore';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const servers = useServerStore((s) => s.servers);

  const selectedDevice = devices.find((d) => d.id === selectedId);
  const server = servers.find((s) => s.id === selectedDevice?.serverId);
  const isDisconnected = !server || server.connectionState !== 'connected';

  return (
    <div className={styles.content}>
      <StatusControlBar />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChartGrid />
        {isDisconnected && selectedDevice && (
          <div className={styles.disconnectedOverlay}>
            连接已断开 —— 实时数据暂不可用
          </div>
        )}
      </div>
    </div>
  );
}
