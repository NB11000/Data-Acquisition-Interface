import type { LegacyDevice } from './types';
import { generateGuid } from '../utils/id';

interface OldDevice {
  id: string;
  name: string;
  brokerUrl?: string;
  port?: number;
  username?: string;
  password?: string;
  tls?: boolean;
  isOnline?: boolean | null;
}

interface UniqueBroker {
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

function hasBrokerUrl(d: OldDevice): d is Required<Pick<OldDevice, 'brokerUrl' | 'port' | 'username' | 'password' | 'tls'>> & OldDevice {
  return typeof d.brokerUrl === 'string' && d.brokerUrl.length > 0;
}

function extractUniqueBrokers(devices: OldDevice[]): UniqueBroker[] {
  const seen = new Set<string>();
  const result: UniqueBroker[] = [];
  for (const d of devices) {
    if (!hasBrokerUrl(d)) continue;
    const key = `${d.brokerUrl}|${d.port ?? 0}|${d.username ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      brokerUrl: d.brokerUrl,
      port: d.port ?? 0,
      username: d.username ?? '',
      password: d.password ?? '',
      tls: d.tls ?? false,
    });
  }
  return result;
}

/** 一次性迁移：旧格式 Device（含 brokerUrl）→ 新格式（MqttServer + Device） */
export function runMigration(): boolean {
  const raw = localStorage.getItem('devices');
  if (raw === null) return false;

  // 新 key mqttServers 已存在 → 已迁移过，跳过
  if (localStorage.getItem('mqttServers') !== null) return false;

  let oldDevices: OldDevice[];
  try {
    oldDevices = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!Array.isArray(oldDevices) || oldDevices.length === 0) return false;

  // 检测是否为旧格式（至少有一个设备包含 brokerUrl）
  if (!oldDevices.some(hasBrokerUrl)) return false;

  const brokers = extractUniqueBrokers(oldDevices);
  if (brokers.length === 0) return false;

  // 生成服务器列表（合并端口到 URL，根据旧 tls 标志补全协议前缀）
  const servers = brokers.map((b, i) => {
    let url = /:\d+$/.test(b.brokerUrl)
      ? b.brokerUrl
      : `${b.brokerUrl}:${b.port}`;
    if (!/^mqtts?:\/\//.test(url)) {
      url = (b.tls ? 'mqtts://' : 'mqtt://') + url;
    }
    return {
      id: generateGuid(),
      name: `默认服务器 ${i + 1}`,
      brokerUrl: url,
      username: b.username,
      password: b.password,
      connected: false,
    };
  });

  // 构建 broker→serverId 映射
  const brokerKeyToServerId = new Map<string, string>();
  for (const s of servers) {
    const key = `${s.brokerUrl}|${s.username}`;
    brokerKeyToServerId.set(key, s.id);
  }

  // 转换旧设备 → 新格式
  const newDevices = oldDevices.map((d) => {
    const rawUrl = d.brokerUrl ?? '';
    const deviceKey = /:\d+$/.test(rawUrl)
      ? `${rawUrl}|${d.username ?? ''}`
      : `${rawUrl}:${d.port ?? 0}|${d.username ?? ''}`;
    return {
      id: d.id,
      name: d.name,
      serverId: brokerKeyToServerId.get(deviceKey) ?? '',
      isOnline: d.isOnline ?? null,
    };
  });

  // 写入新 keys
  localStorage.setItem('mqttServers', JSON.stringify(servers));
  localStorage.setItem('devices', JSON.stringify(newDevices));

  return true;
}
