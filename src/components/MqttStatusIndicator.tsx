import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import styles from './MqttStatusIndicator.module.css';

export function MqttStatusIndicator() {
  const mqttConnected = useMqttStore((s) => s.mqttConnected);
  const willReceived = useMqttStore((s) => s.willReceived);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const processConnected = useCollectorStore((s) => s.processConnected);
  const laserConnected = useLaserStore((s) => s.serialConnected);

  const mqttOnline = mqttConnected && !willReceived;
  const collectorOnline = processConnected && mqttOnline;

  return (
    <div className={styles.indicators}>
      <div className={styles.item}>
        <span className={`${styles.dot} ${mqttOnline ? styles.green : styles.red}`} />
        <span>MQTT {mqttOnline ? '已连接' : (willReceived ? '遗嘱' : '未连接')}</span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${collectorOnline ? (acquiring ? styles.green : styles.yellow) : styles.gray}`} />
        <span>采集 {acquiring ? '采集中' : (collectorOnline ? '未采集' : '离线')}</span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${laserConnected ? styles.green : styles.gray}`} />
        <span>激光 {laserConnected ? '已连接' : '未连接'}</span>
      </div>
    </div>
  );
}
