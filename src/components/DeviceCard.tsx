import type { Device } from '../stores/deviceStore';
import styles from './DeviceCard.module.css';

interface Props {
  device: Device;
  isSelected: boolean;
  onClick: () => void;
}

export function DeviceCard({ device, isSelected, onClick }: Props) {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.title}>
        <span className={`${styles.statusDot} ${device.isOnline ? styles.online : styles.offline}`} />
        <span>{device.name}</span>
      </div>
      <div className={styles.subtitle}>{device.id}</div>
    </div>
  );
}
