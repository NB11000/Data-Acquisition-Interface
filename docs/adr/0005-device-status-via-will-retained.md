# ADR 0005: 设备在线状态通过 Will Retained 消息实现

**日期**: 2026-06-03
**状态**: Accepted

## 背景

当前前端通过 `$SYS/brokers/+/clients/+/connected|disconnected` 监控设备在线状态。该方案存在两个致命缺陷：

1. **时序依赖导致状态丢失** — `$SYS` 消息仅在设备连接/断开瞬间发布一次，无 retained 标志。前端连接晚于设备或断线重连后，已发生的事件无法回溯，已在线设备永远显示为"离线/未知"。
2. **依赖 broker 类型** — `$SYS` 主题格式因 broker 而异（EMQX、Mosquitto、HiveMQ），换 broker 需改代码。

## 决策

**废弃 `$SYS` 主题，改用设备自身发布的 retained 消息实现在线状态监控。**

核心机制：设备在 `daq/{MachineId}/events/will` 主题上发布 retained=true 的状态消息，三种场景共用一个 topic：

| 场景 | 触发 | status | eventType |
|------|------|--------|-----------|
| 设备上线 | CONNACK 后 publish | `"online"` | `"device_online"` |
| 设备正常下线 | DISCONNECT 前 publish | `"offline"` | `"device_offline"` |
| 设备崩溃 | Broker 代发 Will | `"offline"` | `"process_crashed"` |

前端使用通配符一次性订阅 `daq/+/events/will`（qos=1），利用 retained 机制：
- 连接时立即获取所有设备最新状态（全量恢复）
- 后续增量更新实时推送
- 断线重连后自动恢复

## 与 ADR 0003 的协同

`MachineId` 从 topic 第二段提取 `daq/{MachineId}/events/will`，payload 不携带 deviceId。通配符订阅按连接隔离（每个 MqttServer 独立连接），ACL 限制保证只收到授权范围内的设备状态。

## 理由

1. **消灭时序问题** — retained 消息持久存在于 broker，任何时候订阅都能拿到最新状态。前端晚于设备上线、断线重连后都能自动恢复全量状态。
2. **broker 无关** — 主题格式由设备侧定义，不依赖任何 broker 特定的系统主题。
3. **单一数据源** — 同一 topic 承载上线/离线/崩溃三种事件，retained 覆盖保证状态始终最新，无需协调多主题。
4. **简化订阅管理** — 通配符一次订阅替代逐设备订阅 + $SYS 双轨机制，减少代码复杂度。

## 代价

1. **~45s 崩溃检测延迟** — 设备崩溃后 Broker 需等待 keepalive 超时才推送 Will。此窗口期不尝试用"疑似离线"状态弥补（侧边栏未选中设备无数据流可供判断）。
2. **Device 数据模型扩展** — `isOnline` 三态（true/false/null）无法区分离线原因，需新增 `lastEventType` 字段。
3. **自动发现机制改变** — 从 `$SYS` 在线客户端缓存改为基于 retained 消息的在线设备池（语义一致：都只展示在线设备）。
4. **设备侧需配合改造** — 设备端须按三部曲实现（Will Message + CONNACK 后 publish online + DISCONNECT 前 publish offline）。

## 替代方案

**保持 $SYS 并增加心跳轮询**：定时 RPC ping 所有设备以弥补 $SYS 的时序问题。被否定 —— N 台设备 × M 台服务器的 O(N×M) 定时器复杂度不可接受，且违背 MQTT 推送语义。

**保留 $SYS + 新增 retained**：双轨并行，$SYS 做即时通知，retained 做状态恢复。被否定 —— 两条路径会在同一设备上产生冲突，需要额外的合并逻辑，且 $SYS 的 broker 依赖问题仍然存在。
