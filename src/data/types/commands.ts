/** RPC CommandResult — 统一响应格式 */
export interface CommandResult {
  success: boolean;
  code: string;
  message: string;
  state?: import('./state').SystemStateDto | null;
  timestamp: string;
}

/** 设备告警负载 */
export interface DeviceAlarmPayload {
  alarmType: string;
  device: string;
  message: string;
  severity: number;
  timestamp: string;
}

/** 检测告警负载 */
export interface DetectionAlertPayload {
  alarmType: string;
  severity: string;
  timestamp: number;
  ch1: number;
  ch2: number;
}

/** 低频采样数据 */
export interface LowFreqSample {
  timestamp: number;
  utc: string;
  ch1: number;
  ch2: number;
  vis: number;
  cn2: number;
  temp: number;
  humi: number;
  press: number;
  windSpd: number;
  rain: number;
  windDir: number;
}

/** 设备信息 (用于侧边栏列表) */
export interface DeviceInfo {
  name: string;
  machineId: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  status: import('./state').DeviceOnlineStatus;
}

/** 按钮操作状态 */
export type ButtonPhase = 'idle' | 'sending' | 'running' | 'error';
