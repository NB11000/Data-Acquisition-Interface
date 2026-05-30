import { useMemo, useState, useEffect, useCallback } from 'react';
import { Input, Button, Tree } from 'antd';
import { SearchOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useDeviceStore, type Device } from '../stores/deviceStore';
import { useServerStore, type PoolConnectionState } from '../stores/serverStore';
import styles from './Sidebar.module.css';

interface Props {
  onAddDevice: () => void;
  onEditDevice: (device: Device) => void;
}

/** 服务器连接状态 → 颜色 */
function connectionStateColor(state: PoolConnectionState): string {
  switch (state) {
    case 'connected':    return '#52c41a';
    case 'reconnecting': return '#faad14';
    case 'failed':       return '#ff4d4f';
    case 'initializing': return '#1677ff';
    default:             return '#8c8c8c';
  }
}

/** 设备在线状态图标 */
function DeviceStatusIcon({ isOnline, serverConnected }: { isOnline: boolean | null; serverConnected: boolean }) {
  if (!serverConnected) {
    return <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />;
  }
  if (isOnline === true) {
    return <span className={styles.dot} style={{ backgroundColor: '#52c41a' }} />;
  }
  if (isOnline === false) {
    return <span className={styles.dot} style={{ backgroundColor: '#8c8c8c' }} />;
  }
  return <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />;
}

export function Sidebar({ onAddDevice, onEditDevice }: Props) {
  const servers = useServerStore((s) => s.servers);
  const devices = useDeviceStore((s) => s.devices);
  const selectedId = useDeviceStore((s) => s.selectedId);
  const searchText = useDeviceStore((s) => s.searchText);
  const setSelected = useDeviceStore((s) => s.setSelected);
  const setSearch = useDeviceStore((s) => s.setSearch);

  // 默认展开所有有设备的服务器
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() =>
    servers.filter((s) => devices.some((d) => d.serverId === s.id)).map((s) => `server-${s.id}`),
  );

  // 按服务器分组
  const grouped = useMemo(() => {
    return servers.map((srv) => ({
      server: srv,
      devices: devices.filter((d) => d.serverId === srv.id),
      connectionState: (srv.connectionState || 'disconnected') as PoolConnectionState,
    }));
  }, [servers, devices]);

  // 搜索过滤
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return grouped;

    return grouped
      .map((g) => ({
        ...g,
        devices: g.devices.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.devices.length > 0);
  }, [grouped, searchText]);

  // 搜索时自动展开匹配的服务器
  useEffect(() => {
    if (searchText.trim()) {
      setExpandedKeys(filtered.map((g) => `server-${g.server.id}`));
    }
  }, [searchText, filtered]);

  // 构建树数据
  const treeData = useMemo<DataNode[]>(() => {
    return filtered.map((g) => {
      const isConnected = g.connectionState === 'connected';
      const dotColor = connectionStateColor(g.connectionState);

      const serverTitle = (
        <span className={!isConnected ? styles.grayed : ''}>
          <span className={styles.dot} style={{ backgroundColor: dotColor }} />
          <span style={{ marginLeft: 6 }}>{g.server.name}</span>
        </span>
      );

      return {
        key: `server-${g.server.id}`,
        title: serverTitle,
        selectable: false,
        children: g.devices.map((d) => {
          const isSelected = d.id === selectedId;
          return {
            key: `device-${d.id}`,
            title: (
              <span className={isSelected ? styles.selectedDevice : ''}>
                <DeviceStatusIcon isOnline={d.isOnline} serverConnected={isConnected} />
                <span style={{ marginLeft: 6 }}>{d.name}</span>
              </span>
            ),
            isLeaf: true,
            selectable: true,
          } as DataNode;
        }),
      } as DataNode;
    });
  }, [filtered, selectedId]);

  // 树节点选择 → 设备选中
  const handleSelect = useCallback(
    (keys: React.Key[]) => {
      if (keys.length === 0) return;
      const key = String(keys[0]);
      if (key.startsWith('device-')) {
        setSelected(key.slice(7));
      }
    },
    [setSelected],
  );

  const handleExpand = useCallback((keys: React.Key[]) => {
    setExpandedKeys(keys.map(String));
  }, []);

  const onlineCount = devices.filter((d) => d.isOnline === true).length;

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

      <div className={styles.treeContainer}>
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            selectedKeys={selectedId ? [`device-${selectedId}`] : []}
            expandedKeys={expandedKeys}
            onSelect={handleSelect}
            onExpand={handleExpand}
            blockNode
          />
        ) : (
          <div className={styles.empty}>暂无设备</div>
        )}
      </div>

      <div className={styles.footer}>
        <Button icon={<PlusOutlined />} block onClick={onAddDevice}>
          添加设备
        </Button>
      </div>
    </div>
  );
}
