// ── RPC ──
export interface CommandResult {
  success: boolean;
  code: string;
  message: string;
  state?: SystemStateDto;
  timestamp: string;
}

// ── SystemState ──
export interface SystemStateDto {
  server: { isApiAlive: boolean; timestamp: string };
  collector: CollectorStateDto;
  laser: LaserStateDto;
  uiHints?: UiHintsDto;
  timestamp: string;
}

export interface CollectorStateDto {
  processConnected: boolean;
  deviceOpened: boolean;
  acquiring: boolean;
  handle?: number;
  lastMessage?: string;
  timestamp?: string;
}

export interface LaserStateDto {
  serialConnected: boolean;
  emissionOn: boolean;
  portName?: string;
  lastMessage?: string;
  timestamp?: string;
}

export interface UiHintsDto {
  canOpenCollector: boolean;
  canCloseCollector: boolean;
  canStartAcquisition: boolean;
  canStopAcquisition: boolean;
  canConnectLaser: boolean;
  canDisconnectLaser: boolean;
  canTurnLaserOn: boolean;
  canTurnLaserOff: boolean;
}

// ── Events ──
export interface StateChangedEvent {
  eventType: string;
  source: 'collector' | 'laser' | 'system' | 'mqtt_broker';
  reason: string;
  message: string;
  state: SystemStateDto;
  timestamp: string;
}

export interface WillMessage {
  eventType: 'process_crashed';
  source: 'mqtt_broker';
  reason: 'will_message';
  message: string;
}

export interface DeviceAlarm {
  alarmType: string;
  device: string;
  message: string;
  severity: number;
  timestamp: string;
}

// ── LowFreq ──
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

// ── $SYS ──
export interface SysClientEvent {
  connected: boolean;
  clientid: string;
  username?: string;
  ts?: number;
}

// ── Device ──
export interface DeviceInfo {
  id: string;
  name: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}
