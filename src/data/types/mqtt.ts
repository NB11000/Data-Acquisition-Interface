/** MQTT RPC 请求负载 */
export interface RpcRequest {
  method: RpcMethod;
  payload?: unknown;
}

/** RPC 方法枚举 */
export enum RpcMethod {
  SYSTEM_STATE = 'SYSTEM_STATE',
  COLLECTOR_OPEN_DEVICE = 'collector-open-device',
  COLLECTOR_OPEN_DEVICE_AGAIN = 'collector-open-device-again',
  COLLECTOR_CLOSE_DEVICE = 'collector-close-device',
  COLLECTOR_START_AD = 'collector-start-ad',
  COLLECTOR_STOP_AD = 'collector-stop-ad',
  COLLECTOR_STATUS = 'collector-status',
  COLLECTOR_PING = 'collector-ping',
  LASER_CONNECT = 'laser-connect',
  LASER_DISCONNECT = 'laser-disconnect',
  LASER_ON = 'laser-on',
  LASER_OFF = 'laser-off',
  LASER_STATUS = 'laser-status',
}

/** MQTT 连接配置 */
export interface MqttConnectionConfig {
  brokerUrl: string;
  username: string;
  password: string;
  machineId: string;
  port?: number;
  clientId?: string;
}

/** 待处理的 RPC 请求 */
export interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  method: RpcMethod;
}

/** 遗嘱消息负载 */
export interface WillMessagePayload {
  eventType: 'process_crashed';
  source: 'mqtt_broker';
  reason: 'will_message';
  message: string;
}

/** 主题常量 */
export const TOPIC = {
  STATE_CHANGED: (machineId: string) => `daq/${machineId}/events/state_changed`,
  WILL: (machineId: string) => `daq/${machineId}/events/will`,
  DEVICE_ALARM: (machineId: string) => `daq/${machineId}/events/device_alarm`,
  WAVEFORM_CH1: (machineId: string) => `daq/${machineId}/waveform/ch1`,
  WAVEFORM_CH2: (machineId: string) => `daq/${machineId}/waveform/ch2`,
  LOWFREQ: (machineId: string) => `daq/${machineId}/lowfreq`,
  DETECTION_ALERTS: (machineId: string) => `daq/${machineId}/detection/alerts`,
  RPC_REQUEST: (machineId: string, method: string, corrId: string) =>
    `$rpc/${machineId}/${method}/${corrId}`,
  RPC_RESPONSE_PATTERN: (machineId: string) =>
    `$rpc/${machineId}/+/+/response`,
  EVENTS: (machineId: string) => `daq/${machineId}/events/#`,
} as const;
