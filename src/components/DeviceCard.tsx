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

export function DeviceCard({ device, isSelected, onClick, onEdit, onDelete }: Props) {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.row1}>
        <span className={styles.name}>{device.name}</span>
        <span className={styles.status}>
          <span className={`${styles.statusDot} ${device.isOnline ? styles.online : styles.offline}`} />
          <span className={styles.statusText}>{device.isOnline ? '在线' : '离线'}</span>
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
