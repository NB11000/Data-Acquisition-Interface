import { Modal, Form, Input, InputNumber, Switch, Button, message } from 'antd';
import { useDeviceStore, type Device } from '../../stores/deviceStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManualAddModal({ open, onClose }: Props) {
  const [form] = Form.useForm();
  const addDevice = useDeviceStore((s) => s.addDevice);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const device: Device = {
        id: values.machineId,
        name: values.name || values.machineId,
        brokerUrl: values.brokerUrl,
        port: values.port,
        username: values.username,
        password: values.password,
        tls: values.tls ?? false,
        isOnline: false,
      };
      addDevice(device);
      message.success(`设备 "${device.name}" 已添加`);
      form.resetFields();
      onClose();
    });
  };

  return (
    <Modal title="手动添加设备" open={open} onCancel={onClose} footer={null} width={480}>
      <Form form={form} layout="vertical" initialValues={{ port: 8883, tls: false }}>
        <Form.Item name="name" label="设备名称">
          <Input placeholder="如：一号高塔节点" />
        </Form.Item>
        <Form.Item name="machineId" label="MachineId" rules={[{ required: true, message: '请输入 MachineId' }]}>
          <Input placeholder="如：daq-srv-01" />
        </Form.Item>
        <Form.Item name="brokerUrl" label="Broker 地址" rules={[{ required: true, message: '请输入 Broker 地址' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="port" label="端口号">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="username" label="用户名">
          <Input />
        </Form.Item>
        <Form.Item name="password" label="密码">
          <Input.Password />
        </Form.Item>
        <Form.Item name="tls" label="开启 TLS" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" block onClick={handleSubmit}>
          测试连接并保存
        </Button>
      </Form>
    </Modal>
  );
}
