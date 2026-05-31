import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Select, Button, Tabs, Input, Table, message, Empty,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDeviceStore, type Device } from '../../stores/deviceStore';
import { useServerStore } from '../../stores/serverStore';
import { getPool } from '../../mqtt/pool';
import { MqttServerModal } from './MqttServerModal';
import styles from './AddDeviceModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddDeviceModal({ open, onClose }: Props) {
  const servers = useServerStore((s) => s.servers);
  const addDevice = useDeviceStore((s) => s.addDevice);

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('manual');
  const [machineId, setMachineId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  // 服务器列表为空 → 显示服务器配置界面
  const showServerSetup = servers.length === 0 && !serverModalOpen;

  // 重置状态
  useEffect(() => {
    if (!open) return;
    setSelectedServerId(null);
    setActiveTab('manual');
    setMachineId('');
    setDeviceName('');
    setSelectedMachines([]);
  }, [open]);

  // 当服务器列表从空变为非空时，自动选中第一个
  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  const handleServerAdded = useCallback(() => {
    setServerModalOpen(false);
    // 延迟等 store 更新后再选中最新服务器
    setTimeout(() => {
      const latest = useServerStore.getState().servers;
      if (latest.length > 0) {
        setSelectedServerId(latest[latest.length - 1].id);
      }
    }, 100);
  }, []);

  // 自动发现设备列表
  const discoverMachines = useCallback(() => {
    if (!selectedServerId) return [];
    const pool = getPool();
    const clients = pool.getOnlineClients(selectedServerId);
    return Array.from(clients).map((id) => ({ machineId: id, online: true }));
  }, [selectedServerId]);

  const machines = discoverMachines();

  const handleManualAdd = () => {
    if (!selectedServerId) {
      message.warning('请先选择服务器');
      return;
    }
    if (!machineId.trim()) {
      message.warning('请输入 Device ID');
      return;
    }

    const device: Device = {
      id: machineId.trim(),
      name: deviceName.trim() || machineId.trim(),
      serverId: selectedServerId,
      isOnline: null,
    };

    const existingDevice = useDeviceStore.getState().devices.find((d) => d.id === device.id);
    if (existingDevice) {
      message.warning(`设备 "${device.id}" 已存在`);
      return;
    }

    addDevice(device);
    message.success(`设备 "${device.name}" 已添加`);
    onClose();
  };

  const handleBatchAdd = () => {
    if (!selectedServerId) {
      message.warning('请先选择服务器');
      return;
    }
    if (selectedMachines.length === 0) {
      message.warning('请选择要添加的设备');
      return;
    }

    const pool = getPool();
    let added = 0;
    for (const id of selectedMachines) {
      const m = machines.find((m) => m.machineId === id);
      if (!m) continue;
      const existingDevice = useDeviceStore.getState().devices.find((d) => d.id === m.machineId);
      if (existingDevice) continue;

      const device: Device = {
        id: m.machineId,
        name: m.machineId,
        serverId: selectedServerId,
        isOnline: m.online,
      };
      addDevice(device);
      pool.subscribeDevice(selectedServerId, device.id);
      added++;
    }
    message.success(`已添加 ${added} 台设备`);
    onClose();
  };

  const discoverColumns = [
    { title: 'Device ID', dataIndex: 'machineId', key: 'machineId' },
    {
      title: '状态',
      dataIndex: 'online',
      key: 'online',
      render: (v: boolean) => (v ? '🟢 在线' : '🔴 离线'),
    },
  ];

  // 零服务器引导：直接展示 MqttServerModal
  if (showServerSetup) {
    return (
      <MqttServerModal
        open={open}
        onClose={onClose}
        onSuccess={handleServerAdded}
      />
    );
  }

  const serverOptions = servers.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.brokerUrl}:${s.port})`,
  }));

  const tabItems = [
    {
      key: 'manual',
      label: '手动添加',
      children: (
        <div className={styles.tabContent}>
          <div className={styles.field}>
            <label>Device ID</label>
            <Input
              placeholder="如：daq-srv-01"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              onPressEnter={handleManualAdd}
            />
          </div>
          <div className={styles.field}>
            <label>设备名称</label>
            <Input
              placeholder="如：一号高塔节点"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              onPressEnter={handleManualAdd}
            />
          </div>
          <Button type="primary" block onClick={handleManualAdd}>
            添加
          </Button>
        </div>
      ),
    },
    {
      key: 'discover',
      label: '自动发现',
      children: (
        <div className={styles.tabContent}>
          {machines.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span>没有发现在线设备<br />请确认服务器已连接且设备已上线</span>}
            />
          ) : (
            <>
              <Table
                size="small"
                rowKey="machineId"
                columns={discoverColumns}
                dataSource={machines}
                rowSelection={{
                  selectedRowKeys: selectedMachines,
                  onChange: (keys) => setSelectedMachines(keys as string[]),
                }}
                pagination={false}
              />
              <div className={styles.batchFooter}>
                <Button
                  type="primary"
                  disabled={selectedMachines.length === 0}
                  onClick={handleBatchAdd}
                >
                  确认添加 ({selectedMachines.length})
                </Button>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title="添加设备"
        open={open}
        onCancel={onClose}
        footer={null}
        width={520}
        destroyOnClose
      >
        <div className={styles.serverRow}>
          <Select
            className={styles.serverSelect}
            placeholder="选择 MQTT 服务器"
            value={selectedServerId}
            onChange={(v) => setSelectedServerId(v)}
            options={serverOptions}
          />
          <Button
            className={styles.addBtn}
            icon={<PlusOutlined />}
            onClick={() => setServerModalOpen(true)}
          >
            新增
          </Button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          destroyInactiveTabPane
        />
      </Modal>

      <MqttServerModal
        open={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        onSuccess={handleServerAdded}
      />
    </>
  );
}
