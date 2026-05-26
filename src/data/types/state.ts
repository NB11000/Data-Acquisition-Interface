/** 采集卡子状态 */
export interface CollectorState {
  processConnected: boolean;
  deviceOpened: boolean;
  acquiring: boolean;
  handle: number;
  lastMessage: string;
  timestamp: string;
}

/** 激光器子状态 */
export interface LaserState {
  serialConnected: boolean;
  emissionOn: boolean;
  portName: string;
  lastMessage: string;
  timestamp: string;
}

/** 服务端子状态 */
export interface ServerState {
  isApiAlive: boolean;
  timestamp: string;
}

/** 后端 UI 提示字段 (后端计算, 仅做参考。前端本地计算为主) */
export interface UiHints {
  canOpenCollector: boolean;
  canCloseCollector: boolean;
  canStartAcquisition: boolean;
  canStopAcquisition: boolean;
  canConnectLaser: boolean;
  canDisconnectLaser: boolean;
  canTurnLaserOn: boolean;
  canTurnLaserOff: boolean;
}

/** SystemStateDto — 全量系统状态快照 */
export interface SystemStateDto {
  server: ServerState;
  collector: CollectorState;
  laser: LaserState;
  uiHints: UiHints;
  timestamp: string;
}

/** 状态变更事件 */
export interface StateChangedEvent {
  eventType: string;
  source: string;
  reason: string;
  message: string;
  state: SystemStateDto | null;
  timestamp: string;
}

/** 按钮禁用状态映射 */
export interface ButtonDisabledMap {
  openCollector: boolean;
  closeCollector: boolean;
  startAcquisition: boolean;
  stopAcquisition: boolean;
  connectLaser: boolean;
  disconnectLaser: boolean;
  laserOn: boolean;
  laserOff: boolean;
}

/** 设备在线状态 */
export type DeviceOnlineStatus = 'online' | 'offline' | 'unknown';

/** 采集状态 */
export type CollectionStatus = 'idle' | 'acquiring' | 'unknown';

/** 激光状态 */
export type LaserRunStatus = 'idle' | 'emitting' | 'unknown';
