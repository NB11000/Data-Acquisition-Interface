import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Tag, Button, Modal, Empty, Typography, Space,
} from 'antd';
import {
  LoadingOutlined, CheckCircleOutlined, MinusCircleOutlined,
  SyncOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined,
  LinkOutlined, DisconnectOutlined, PlusOutlined,
} from '@ant-design/icons';
import { getPool } from '../../mqtt/pool';
import { useServerStore, type MqttServer, type PoolConnectionState } from '../../stores/serverStore';
import { useDeviceStore, type Device } from '../../stores/deviceStore';
import { useWaveformStore } from '../../stores/waveformStore';
import { useDataStore } from '../../stores/dataStore';
import { useAlarmStore } from '../../stores/alarmStore';
import { MqttServerModal } from '../../components/modals/MqttServerModal';
import styles from './Settings.module.css';

export default function Settings() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MqttServer | undefined>();
  const retryCounts = useRef<Record<string, number>>({});

  const servers = useServerStore((s) => s.servers);
  const devices = useDeviceStore((s) => s.devices);
  const removeDeviceFromStore = useDeviceStore((s) => s.removeDevice);
  const removeServerFromStore = useServerStore((s) => s.removeServer);

  const pool = getPool();

  // 仅追踪重连次数（连接状态由 useMqttConnect 维护在 serverStore.connectionState 中）
  useEffect(() => {
    const listener = (data: { serverId: string; state: string }) => {
      if (data.state === 'reconnecting') {
        retryCounts.current[data.serverId] = (retryCounts.current[data.serverId] ?? 0) + 1;
      } else {
        retryCounts.current[data.serverId] = 0;
      }
    };
    pool.onStateChange(listener);
    return () => { pool.offStateChange(listener); };
  }, [pool]);

  const getState = useCallback(
    (serverId: string): PoolConnectionState =>
      servers.find((s) => s.id === serverId)?.connectionState ?? 'disconnected',
    [servers],
  );

  const getDeviceCount = useCallback(
    (serverId: string) => devices.filter((d) => d.serverId === serverId).length,
    [devices],
  );

  const getServerDevices = useCallback(
    (serverId: string) => devices.filter((d) => d.serverId === serverId),
    [devices],
  );

  const getServerName = useCallback(
    (serverId: string) => servers.find((s) => s.id === serverId)?.name ?? serverId,
    [servers],
  );

  const handleAdd = () => {
    setEditingServer(undefined);
    setModalOpen(true);
  };

  const handleEdit = (server: MqttServer) => {
    setEditingServer(server);
    setModalOpen(true);
  };

  const handleDelete = (server: MqttServer) => {
    const serverDevices = getServerDevices(server.id);
    const desc = serverDevices.length > 0
      ? `将同时删除以下 ${serverDevices.length} 个设备：${serverDevices.map((d) => d.name).join('、')}`
      : `确定删除服务器「${server.name}」？`;

    Modal.confirm({
      title: '确认删除服务器',
      content: <div style={{ maxHeight: 200, overflow: 'auto' }}>{desc}</div>,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        pool.destroy(server.id);
        removeServerFromStore(server.id);
        for (const d of serverDevices) {
          removeDeviceFromStore(d.id);
        }
      },
    });
  };

  const handleConnect = (server: MqttServer) => {
    pool.create(server);
  };

  const handleDisconnect = (serverId: string) => {
    pool.destroy(serverId);
  };

  const renderStateIcon = (state: PoolConnectionState) => {
    switch (state) {
      case 'initializing':
        return <LoadingOutlined spin style={{ color: '#8c8c8c' }} />;
      case 'connected':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'disconnected':
        return <MinusCircleOutlined style={{ color: '#8c8c8c' }} />;
      case 'reconnecting':
        return <SyncOutlined spin style={{ color: '#fa8c16' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
    }
  };

  const renderStateText = (serverId: string, state: PoolConnectionState) => {
    switch (state) {
      case 'initializing':
        return '初始化中…';
      case 'connected':
        return '已连接';
      case 'disconnected':
        return '已断开';
      case 'reconnecting': {
        const n = retryCounts.current[serverId] ?? 0;
        return `重连 ${n}/3`;
      }
      case 'failed':
        return '连接失败';
    }
  };

  return (
    <div className={styles.container}>
      {/* ── MQTT 服务器管理 ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Typography.Title level={4} className={styles.sectionTitle}>
            MQTT 服务器管理
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加 MQTT 服务器
          </Button>
        </div>

        {servers.length === 0 ? (
          <Empty description="暂无 MQTT 服务器，请点击上方按钮添加" />
        ) : (
          <div className={styles.serverList}>
            {servers.map((server) => {
              const state = getState(server.id);
              return (
                <div key={server.id} className={styles.serverCard}>
                  <div className={styles.serverRow} style={{ padding: '12px 16px' }}>
                    <div className={styles.serverMain}>
                      <div className={styles.serverHeader}>
                        <span className={styles.serverName}>{server.name}</span>
                        <span className={styles.stateTag}>
                          {renderStateIcon(state)}
                          <span className={styles.stateText}>
                            {renderStateText(server.id, state)}
                          </span>
                        </span>
                      </div>
                      <div className={styles.serverMeta}>
                        <span className={styles.brokerUrl}>{server.brokerUrl}:{server.port}</span>
                        <span className={styles.deviceCount}>
                          {getDeviceCount(server.id)} 台设备
                        </span>
                      </div>
                    </div>
                    <div className={styles.serverActions}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(server)}>
                        编辑
                      </Button>
                      {(state === 'disconnected' || state === 'failed') && (
                        <Button
                          size="small"
                          type="primary"
                          icon={<LinkOutlined />}
                          onClick={() => handleConnect(server)}
                        >
                          连接
                        </Button>
                      )}
                      {state === 'connected' && (
                        <Button
                          size="small"
                          icon={<DisconnectOutlined />}
                          onClick={() => handleDisconnect(server.id)}
                        >
                          断开
                        </Button>
                      )}
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(server)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 设备列表 ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Typography.Title level={4} className={styles.sectionTitle}>
            设备列表
          </Typography.Title>
        </div>

        {devices.length === 0 ? (
          <Empty description="暂无设备" />
        ) : (
          <table className={styles.deviceTable} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color, #30363d)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>设备 ID</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>名称</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>所属服务器</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>在线状态</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: 60 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const serverState = getState(d.serverId);
                return (
                  <tr
                    key={d.id}
                    style={{ borderBottom: '1px solid var(--border-color, #30363d)' }}
                  >
                    <td style={{ padding: '8px 12px' }}>{d.id}</td>
                    <td style={{ padding: '8px 12px' }}>{d.name}</td>
                    <td style={{ padding: '8px 12px' }}>{getServerName(d.serverId)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {serverState !== 'connected' ? (
                        <Tag color="default">未知</Tag>
                      ) : d.isOnline === true ? (
                        <Tag color="green">在线</Tag>
                      ) : d.isOnline === false ? (
                        <Tag color="default">离线</Tag>
                      ) : (
                        <Tag color="default">未知</Tag>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          pool.unsubscribeDevice(d.serverId, d.id);
                          if (d.id === useDeviceStore.getState().selectedId) {
                            useWaveformStore.getState().clear();
                            useDataStore.getState().clear();
                            useAlarmStore.getState().clear();
                          }
                          removeDeviceFromStore(d.id);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <MqttServerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        server={editingServer}
      />
    </div>
  );
}
