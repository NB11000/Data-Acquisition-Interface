import { Button, Popconfirm } from 'antd';
import type { Device } from '../stores/deviceStore';
import styles from './DeviceCard.module.css';

interface Props {
  device: Device;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function getStatusText(device: Device): string {
  if (device.isOnline === true) return '在线';
  if (device.isOnline === false) return device.lastEventType === 'process_crashed' ? '已崩溃' : '离线';
  return '未知';
}

function StatusDot({ device }: { device: Device }) {
  let color = '#8c8c8c';
  if (device.isOnline === true) color = '#52c41a';
  else if (device.isOnline === false && device.lastEventType === 'process_crashed') color = '#ff4d4f';
  else if (device.isOnline === false) color = '#8c8c8c';
  return <span className={styles.statusDot} style={{ backgroundColor: color }} />;
}

export function DeviceCard({ device, isSelected, onClick, onEdit, onDelete }: Props) {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.row1}>
        <span className={styles.name}>{device.name}</span>
        <span className={styles.status}>
          <StatusDot device={device} />
          <span className={styles.statusText}>{getStatusText(device)}</span>
        </span>
      </div>
      <div className={styles.row2}>
        <span className={styles.subtitle}>{device.id}</span>
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <Button size="small" type="link" onClick={onEdit}>编辑</Button>
          <Popconfirm title="确定删除此设备？" onConfirm={onDelete} okText="删除" cancelText="取消">
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
