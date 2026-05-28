import { Input, Button } from 'antd';
import { SearchOutlined, ScanOutlined, PlusOutlined } from '@ant-design/icons';
import { useDeviceStore, type Device } from '../stores/deviceStore';
import { DeviceCard } from './DeviceCard';
import styles from './Sidebar.module.css';

interface Props {
  onAutoDiscover: () => void;
  onManualAdd: () => void;
  onEditDevice: (device: Device) => void;
}

export function Sidebar({ onAutoDiscover, onManualAdd, onEditDevice }: Props) {
  const devices = useDeviceStore((s) => s.devices);
  const selectedId = useDeviceStore((s) => s.selectedId);
  const searchText = useDeviceStore((s) => s.searchText);
  const setSelected = useDeviceStore((s) => s.setSelected);
  const setSearch = useDeviceStore((s) => s.setSearch);
  const removeDevice = useDeviceStore((s) => s.removeDevice);

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(searchText.toLowerCase()) ||
      d.id.toLowerCase().includes(searchText.toLowerCase()),
  );

  const onlineCount = devices.filter((d) => d.isOnline).length;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.count}>
          设备列表 ({onlineCount}/{devices.length})
        </div>
        <Input
          size="small"
          prefix={<SearchOutlined />}
          placeholder="搜索设备..."
          value={searchText}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
      </div>

      <div className={styles.list}>
        {filtered.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            isSelected={d.id === selectedId}
            onClick={() => setSelected(d.id)}
            onEdit={() => onEditDevice(d)}
            onDelete={() => removeDevice(d.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            暂无设备
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button icon={<ScanOutlined />} block onClick={onAutoDiscover}>
          自动发现
        </Button>
        <Button icon={<PlusOutlined />} block onClick={onManualAdd}>
          手动添加
        </Button>
      </div>
    </div>
  );
}
