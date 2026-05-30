import { useEffect, useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, Button, Upload, message, Space,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useServerStore, type MqttServer } from '../../stores/serverStore';
import { getPool, testConnection } from '../../mqtt/pool';
import { generateGuid } from '../../utils/id';
import styles from './MqttServerModal.module.css';
import type { UploadFile } from 'antd/es/upload/interface';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  server?: MqttServer;
}

export function MqttServerModal({ open, onClose, onSuccess, server }: Props) {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caCert, setCaCert] = useState('');

  const addServer = useServerStore((s) => s.addServer);
  const updateServer = useServerStore((s) => s.updateServer);
  const findDuplicate = useServerStore((s) => s.findDuplicate);

  const isEdit = !!server;

  useEffect(() => {
    if (!open) return;
    if (server) {
      form.setFieldsValue({
        name: server.name,
        brokerUrl: server.brokerUrl,
        port: server.port,
        username: server.username,
        password: server.password,
        tls: server.tls,
      });
      setCaCert(server.caCert ?? '');
    } else {
      form.resetFields();
      setCaCert('');
    }
  }, [open, server, form]);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const ok = await testConnection(
        values.brokerUrl,
        values.port,
        values.username,
        values.password,
        values.tls ?? false,
      );
      if (ok) {
        message.success('连接测试成功');
      } else {
        message.error('连接测试失败');
      }
    } catch {
      // 表单校验失败
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const data: MqttServer = {
        id: server?.id ?? generateGuid(),
        name: values.name,
        brokerUrl: values.brokerUrl,
        port: values.port,
        username: values.username,
        password: values.password,
        tls: values.tls ?? false,
        connected: false,
        caCert: caCert || undefined,
      };

      if (!isEdit) {
        const dup = findDuplicate(data.brokerUrl, data.port, data.username);
        if (dup) {
          message.warning(`已存在相同连接配置的服务器「${dup.name}」，不能重复添加`);
          setSaving(false);
          return;
        }
        addServer(data);
        const pool = getPool();
        pool.create(data);
      } else {
        updateServer(server!.id, data);
        const pool = getPool();
        pool.update(data);
      }

      message.success(isEdit ? '服务器已更新' : '服务器已添加');
      onSuccess?.();
      onClose();
    } catch {
      // 表单校验失败
    } finally {
      setSaving(false);
    }
  };

  const beforeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCaCert(reader.result as string);
    };
    reader.readAsText(file);
    return false; // 阻止实际上传
  };

  const uploadFileList: UploadFile[] = caCert
    ? [{ uid: 'ca-cert', name: 'ca-cert.pem', status: 'done' as const }]
    : [];

  return (
    <Modal
      title={isEdit ? '编辑 MQTT 服务器' : '添加 MQTT 服务器'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ port: 8883, tls: false }}
        className={styles.form}
      >
        <Form.Item
          name="name"
          label="服务器名称"
          rules={[{ required: true, message: '请输入服务器名称' }]}
        >
          <Input placeholder="如：生产环境 Broker" />
        </Form.Item>

        <Form.Item
          name="brokerUrl"
          label="Broker 地址"
          rules={[{ required: true, message: '请输入 Broker 地址' }]}
        >
          <Input placeholder="如：z0d131fe.ala.cn-hangzhou.emqxsl.cn" />
        </Form.Item>

        <Form.Item
          name="port"
          label="端口号"
          rules={[{ required: true, message: '请选择端口号' }]}
        >
          <Select
            options={[
              { value: 1883, label: '1883 (mqtt)' },
              { value: 8883, label: '8883 (mqtts)' },
            ]}
          />
        </Form.Item>

        <Form.Item name="username" label="用户名">
          <Input placeholder="选填" />
        </Form.Item>

        <Form.Item name="password" label="密码">
          <Input.Password placeholder="选填" />
        </Form.Item>

        <Form.Item name="tls" label="TLS 加密" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="CA 证书（.crt / .pem）">
          <Upload
            beforeUpload={beforeUpload}
            fileList={uploadFileList}
            maxCount={1}
            accept=".crt,.pem"
            onRemove={() => setCaCert('')}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
        </Form.Item>

        <Form.Item noStyle>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>取消</Button>
            <Button loading={testing} onClick={handleTest}>
              测试连接
            </Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
