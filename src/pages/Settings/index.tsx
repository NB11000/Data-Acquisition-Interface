import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Modal, Empty, Typography, Space,
} from 'antd';
import {
  LoadingOutlined, CheckCircleOutlined, MinusCircleOutlined,
  SyncOutlined, CloseCircleOutlined, EditOutlined, DeleteOutlined,
  LinkOutlined, StopOutlined, PlusOutlined,
} from '@ant-design/icons';
import { getPool } from '../../mqtt/pool';
import type { ConnectionState } from '../../mqtt/connectionPool';
import { useServerStore, type MqttServer } from '../../stores/serverStore';
import { useDeviceStore, type Device } from '../../stores/deviceStore';
import { MqttServerModal } from '../../components/modals/MqttServerModal';
import styles from './Settings.module.css';

type ServerStateInfo = { state: ConnectionState; error?: string };

export default function Settings() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MqttServer | undefined>();
  const [serverStates, setServerStates] = useState<Record<string, ServerStateInfo>>({});
  const retryCounts = useRef<Record<string, number>>({});

  const servers = useServerStore((s) => s.servers);
  const devices = useDeviceStore((s) => s.devices);
  const removeDeviceFromStore = useDeviceStore((s) => s.removeDevice);
  const removeServerFromStore = useServerStore((s) => s.removeServer);

  const pool = getPool();

  // 订阅连接池状态变更
  useEffect(() => {
    const listener = (data: { serverId: string; state: ConnectionState; error?: string }) => {
      if (data.state === 'reconnecting') {
        retryCounts.current[data.serverId] = (retryCounts.current[data.serverId] ?? 0) + 1;
      } else {
        retryCounts.current[data.serverId] = 0;
      }
      setServerStates((prev) => ({
        ...prev,
        [data.serverId]: { state: data.state, error: data.error },
      }));
    };
    pool.onStateChange(listener);
    return () => { pool.offStateChange(listener); };
  }, [pool]);

  // 获取某服务器关联设备数
  const getDeviceCount = useCallback(
    (serverId: string) => devices.filter((d) => d.serverId === serverId).length,
    [devices],
  );

  // 获取某服务器关联设备列表
  const getServerDevices = useCallback(
    (serverId: string) => devices.filter((d) => d.serverId === serverId),
    [devices],
  );

  // 获取服务器名称
  const getServerName = useCallback(
    (serverId: string) => servers.find((s) => s.id === serverId)?.name ?? serverId,
    [servers],
  );

  // 打开新增弹窗
  const handleAdd = () => {
    setEditingServer(undefined);
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const handleEdit = (server: MqttServer) => {
    setEditingServer(server);
    setModalOpen(true);
  };

  // 删除服务器
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

  // 手动连接
  const handleConnect = (server: MqttServer) => {
    pool.create(server);
  };

  // 手动断开
  const handleDisconnect = (serverId: string) => {
    pool.destroy(serverId);
  };

  // 渲染 5 态图标
  const renderStateIcon = (serverId: string) => {
    const info = serverStates[serverId];
    const s = info?.state ?? 'disconnected';

    switch (s) {
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

  // 渲染 5 态文字
  const renderStateText = (serverId: string) => {
    const info = serverStates[serverId];
    const s = info?.state ?? 'disconnected';

    switch (s) {
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
      case 'failed': {
        const err = info?.error;
        return err ? `连接失败：${err}` : '连接失败';
      }
    }
  };

  // 渲染操作按钮区
  const renderActions = (server: MqttServer) => {
    const info = serverStates[server.id];
    const s = info?.state ?? 'disconnected';

    return (
      <Space size={4}>
        <Button
          size="small"
          type="text"
          icon={<EditOutlined />}
          onClick={() => handleEdit(server)}
        />
        {(s === 'disconnected' || s === 'failed') && (
          <Button
            size="small"
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => handleConnect(server)}
          >
            连接
          </Button>
        )}
        {s === 'connected' && (
          <Button
            size="small"
            icon={<StopOutlined />}
            onClick={() => handleDisconnect(server.id)}
          >
            断开
          </Button>
        )}
        <Button
          size="small"
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(server)}
        >
          删除
        </Button>
      </Space>
    );
  };

  // 设备表格列定义
  const columns = [
    {
      title: 'Device ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '所属服务器',
      key: 'server',
      render: (_: unknown, record: Device) => getServerName(record.serverId),
    },
    {
      title: '在线状态',
      key: 'online',
      width: 90,
      render: (_: unknown, record: Device) => {
        if (record.isOnline === null) return <Tag>未知</Tag>;
        return record.isOnline
          ? <Tag color="green">在线</Tag>
          : <Tag color="red">离线</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Device) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '确认删除设备',
              content: `确定删除设备「${record.name}」？`,
              okText: '删除',
              okType: 'danger',
              cancelText: '取消',
              onOk: () => {
                pool.unsubscribeDevice(record.serverId, record.id);
                removeDeviceFromStore(record.id);
              },
            });
          }}
        />
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* ── MQTT 服务器管理区 ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Typography.Title level={5} className={styles.sectionTitle}>
            MQTT 服务器管理
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加 MQTT 服务器
          </Button>
        </div>

        {servers.length === 0 ? (
          <Empty description="暂无 MQTT 服务器，点击上方按钮添加" />
        ) : (
          <div className={styles.serverList}>
            {servers.map((srv) => (
              <Card
                key={srv.id}
                size="small"
                className={styles.serverCard}
                styles={{ body: { padding: '10px 14px' } }}
              >
                <div className={styles.serverRow}>
                  <div className={styles.serverMain}>
                    <div className={styles.serverHeader}>
                      <span className={styles.serverName}>{srv.name}</span>
                      <span className={styles.stateTag}>
                        {renderStateIcon(srv.id)}
                        <span className={styles.stateText}>{renderStateText(srv.id)}</span>
                      </span>
                    </div>
                    <div className={styles.serverMeta}>
                      <span className={styles.brokerUrl}>{srv.brokerUrl}:{srv.port}</span>
                      <span className={styles.deviceCount}>
                        关联设备：{getDeviceCount(srv.id)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.serverActions}>
                    {renderActions(srv)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── 设备列表区 ── */}
      <div className={styles.section}>
        <Typography.Title level={5} className={styles.sectionTitle}>
          设备列表
        </Typography.Title>
        <Table
          dataSource={devices}
          columns={columns}
          rowKey="id"
          size="small"
          className={styles.deviceTable}
          locale={{ emptyText: <Empty description="暂无设备" /> }}
          pagination={devices.length > 20 ? { pageSize: 20, showSizeChanger: true } : false}
        />
      </div>

      <MqttServerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        server={editingServer}
      />
    </div>
  );
}
