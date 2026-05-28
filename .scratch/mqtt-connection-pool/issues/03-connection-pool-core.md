# Issue 03: ConnectionPool 连接池内核

**Parent**: [IMPLEMENTATION-PLAN-002](../../../docs/IMPLEMENTATION-PLAN-002.md) — Slice 3
**Status**: needs-triage

---

## Execution Rules

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**
>
> **1. RED** — 先写一个测试，确认测试 FAIL。禁止一次写多个测试。
> **2. GREEN** — 写最少代码让当前测试 PASS。禁止预判未来测试。
> **3. REFACTOR** — 消除重复、深化模块。禁止 RED 期间重构。
>
> **硬禁止：**
> - 禁止"先全部实现再补测试"（水平切片反模式）
> - 禁止跳过 RED 直接写 GREEN
> - 测试必须通过公共接口验证行为，不耦合实现细节
> - 每次循环只一个测试 → 一个实现，垂直切片推进

## What to build

连接池核心模块。维护 `Map<connectionKey, MqttClient>` 和 `Map<machineId, connectionKey>`。管理连接生命周期、常驻主题订阅、选中设备主题切换。

对外接口：
```typescript
interface ConnectionPool {
  init(devices: Device[]): void;
  addDevice(device: Device): void;
  removeDevice(machineId: string): void;
  updateDevice(machineId: string, changes: Partial<Device>): void;
  getConnection(machineId: string): MqttClientLike | null;
  switchSelection(oldMachineId: string | null, newMachineId: string): void;
}
```

**内部逻辑**：
- `init()`: 按 `brokerUrl:port:username:password` 分组 → 每组创建连接 → 订阅改组所有设备的"常驻"主题 → 自动选中第一个设备
- `addDevice()`: 匹配已有连接 → 复用或新建 → 订阅常驻主题 → 如为首个设备则自动选中
- `removeDevice()`: 取消该设备所有订阅 → 若连接无其他设备则断开销毁
- `updateDevice()`: key 变则换连接（取消旧、订阅新）；key 不变则仅更新引用
- `switchSelection()`: 取消旧设备"跟随切换"主题 → 订阅新设备"跟随切换"主题
- 连接失败: 弹 error toast，该连接设备 isOnline = null

**常驻主题**：$SYS connected/disconnected、will、state_changed、device_alarm、RPC response 通配
**跟随切换主题**：waveform/ch1、waveform/ch2、lowfreq、detection/alerts

## Acceptance criteria

- [ ] `init()` 按连接参数正确分组并创建连接
- [ ] 同 key 设备复用同一 MQTT 连接
- [ ] `init()` 后每条连接已订阅对应设备的常驻主题
- [ ] `addDevice()` 可复用连接时不再新建
- [ ] `addDevice()` 不可复用时创建新连接
- [ ] `removeDevice()` 取消该设备所有订阅
- [ ] `removeDevice()` 若连接无其他设备则销毁连接
- [ ] `updateDevice()` key 不变时仅更新映射，不重建连接
- [ ] `updateDevice()` key 变时设备迁移到正确连接
- [ ] `switchSelection()` 正确取消旧设备跟随主题、订阅新设备跟随主题
- [ ] `switchSelection()` 新旧设备在同一连接时仅换主题
- [ ] 连接创建失败时不影响其他连接，失败设备 isOnline = null

## Blocked by

Issue 02 — MQTT 连接工厂重构

## Comments

