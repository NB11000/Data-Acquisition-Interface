# ADR 0004: Mock/Real 依赖注入解耦

**日期**: 2026-05-30
**状态**: Accepted

## 背景

当前代码中 `rpc.ts`、`useMqttConnect.ts`、`client.ts` 等多处包含 `if (MQTT_MODE === 'mock')` 的分支判断。Mock 模式的模拟逻辑和 Real 模式的生产逻辑耦合在一起，导致：

- 真实模式下代码路径经过 mock 判断（虽然不会执行，但影响可读性）
- Mock 逻辑的修改可能意外影响 Real 模式
- 新增功能需在两处同步编写 mock 实现

## 决策

**采用依赖注入解耦 Mock 和 Real。** 定义 `MqttClientLike` 接口和 `MqttConnectionFactory`，Mock 和 Real 各自提供独立实现。App 入口根据 `VITE_MQTT_MODE` 选择工厂注入 ConnectionPool。全代码树中不再出现 `MQTT_MODE` 条件分支。

分层：

```
接口层:  MqttClientLike, MqttConnectionFactory
实现层:  RealMqttClient, MockMqttClient, RealConnectionFactory, MockConnectionFactory
连接池:  ConnectionPool (只依赖接口层)
业务层:  RPC, Router, Stores, Hooks (只依赖 ConnectionPool)
入口层:  AppEntry (根据 VITE_MQTT_MODE 选择工厂)
```

MockMqttClient 内建简易 topic router（`Map<topic, handler[]>`），subscribe 注册 handler、unsubscribe 移除、publish 触发匹配 handler，行为与真实 MQTT 协议一致。

## 理由

1. **隔离变化** — Mock 和 Real 各自独立迭代，互不污染
2. **代码意图清晰** — 读者不会看到 `if (MQTT_MODE)` 分支，不需要推理"另一个分支在什么场景下执行"
3. **测试友好** — Mock 工厂可直接复用于单元测试

## 代价

- 需要维护 `MqttClientLike` 接口的完整性和 Mock/Real 两边实现的一致性
- App 入口处多一层工厂选择逻辑

## 替代方案

**保持 inline 条件分支**：仅在 `client.ts` 初始化处统一判断，其他模块不感知。被否定——随着主题订阅、RPC、在线状态等逻辑增长，inline 判断会持续扩散。
