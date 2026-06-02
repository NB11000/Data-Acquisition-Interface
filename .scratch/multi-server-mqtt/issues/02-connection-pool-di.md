# Issue 2: 连接池核心 + 依赖注入

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

## Parent

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 2

## What to build

定义 MqttClientLike 接口，实现 MockMqttClient（内建 topic router），实现 ConnectionPool（多连接生命周期、状态机、OnlineClientCache、自动重连），实现 ConnectionFactory（Mock/Real 工厂 + 入口注入）。附带 ConnectionPool 和 MockMqttClient 单元测试。

## Acceptance criteria

- [ ] `src/mqtt/mqttClientLike.ts` 定义 `MqttClientLike` 接口（connect/subscribe/unsubscribe/publish/end/isConnected + 事件回调）
- [ ] `src/mqtt/mockClient.ts` 实现 `MockMqttClient`：内建 `Map<topic, handler[]>` topic router；subscribe 注册/unsubscribe 移除/publish 分派到匹配 handler；end(force) 清理
- [ ] `src/mqtt/connectionFactory.ts` 定义 `ConnectionFactory` 接口 + `createRealFactory()` + `createMockFactory()`；App 入口根据 `VITE_MQTT_MODE` 选择工厂
- [ ] `src/mqtt/connectionPool.ts` 实现：
  - `Map<serverId, MqttClient>` 连接池
  - `Map<deviceId, serverId>` 逆向映射
  - `Map<serverId, Set<clientId>>` 在线客户端缓存
  - 5 态连接状态机（initializing/connected/disconnected/reconnecting/failed）
  - `create(server)` → 并行建连 → 订阅 $SYS 主题
  - `destroy(serverId)` → 断开连接 → 取消重连 timer → 清空关联缓存
  - `update(server)` → 仅 name 变更热更新 / 连接参数变更重连
  - `subscribeDevice(serverId, machineId)` / `unsubscribeDevice(serverId, machineId)` — 设备级常驻主题增删
  - `switchFollowing(serverId, machineId)` — 跟随主题切换
  - 空服务器（0 device）→ 断开连接
  - `onMessage` / `onStateChange` 事件发射器
- [ ] 自动重连：指数退避 1s→2s→4s，最多 3 次，超限转入 failed
- [ ] **ConnectionPool 单元测试**：create/destroy/update 生命周期、状态转移、重连 timer 序列、空服务器断连、subscribeDevice 增量
- [ ] **MockMqttClient 单元测试**：subscribe 注册/unsubscribe 移除、publish 分派、wildcard 主题匹配、end 清理

## Blocked by

Issue 1 (data model + stores + migration)
