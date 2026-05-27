import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, Table, message, Steps } from 'antd';
import { useDeviceStore, type Device } from '../../stores/deviceStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const mockDiscoverMachines = [
  { machineId: 'daq-srv-01', online: true },
  { machineId: 'daq-srv-02', online: false },
  { machineId: 'daq-srv-03', online: true },
];

export function AutoDiscoverModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [machines, setMachines] = useState<{ machineId: string; online: boolean }[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const addDevice = useDeviceStore((s) => s.addDevice);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setMachines(mockDiscoverMachines);
      setScanning(false);
      setStep(1);
    }, 1500);
  };

  const handleAdd = () => {
    for (const key of selectedKeys) {
      const m = machines.find((x) => x.machineId === key);
      if (!m) continue;
      const device: Device = {
        id: m.machineId,
        name: m.machineId,
        brokerUrl: 'mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883',
        port: 8883,
        username: '001',
        password: '001',
        tls: true,
        isOnline: false,
      };
      addDevice(device);
    }
    message.success(`已添加 ${selectedKeys.length} 台设备`);
    onClose();
    setStep(0);
    setMachines([]);
    setSelectedKeys([]);
  };

  const columns = [
    { title: 'MachineId', dataIndex: 'machineId' as const, key: 'machineId' },
    {
      title: '状态',
      dataIndex: 'online' as const,
      key: 'online',
      render: (v: boolean) => (v ? '🟢 在线' : '🔴 离线'),
    },
  ];

  return (
    <Modal
      title="自动发现设备"
      open={open}
      onCancel={() => { onClose(); setStep(0); setMachines([]); }}
      footer={null}
      width={560}
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 16 }}
        items={[{ title: '连接 Broker' }, { title: '扫描发现' }, { title: '确认添加' }]}
      />

      {step === 0 && (
        <Form layout="vertical">
          <Form.Item label="Broker 地址">
            <Input defaultValue="mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883" />
          </Form.Item>
          <Form.Item label="端口">
            <InputNumber defaultValue={8883} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="用户名">
            <Input defaultValue="001" />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password defaultValue="001" />
          </Form.Item>
          <Button type="primary" loading={scanning} onClick={handleScan} block>
            开始扫描
          </Button>
        </Form>
      )}

      {step === 1 && (
        <>
          <Table
            size="small"
            rowKey="machineId"
            columns={columns}
            dataSource={machines}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as string[]),
            }}
            pagination={false}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button type="primary" disabled={selectedKeys.length === 0} onClick={handleAdd}>
              添加选中设备 ({selectedKeys.length})
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
