# Issue 1: 数据模型 + Stores + 迁移

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 1

## What to build

建立多服务器架构的数据基础。定义 MqttServer 和 Device 新类型，实现 Zustand stores（含 localStorage 持久化），编写旧格式自动迁移逻辑并附带测试。

## Acceptance criteria

- [ ] `src/mqtt/types.ts` 中定义 `MqttServer` 和更新的 `Device` 接口（Device 移除连接字段，新增 serverId）
- [ ] `src/stores/serverStore.ts` 实现 Zustand store：CRUD + persist 到 localStorage key `mqttServers`；含 `findDuplicate(brokerUrl, port, username)` 去重方法
- [ ] `src/stores/deviceStore.ts` 改造：Device 模型更新为 `{ id, name, serverId, isOnline }`；persist 到 localStorage key `devices`；新增 `getDevicesByServer(serverId)`、`getFilteredDevices()` 方法
- [ ] `src/mqtt/migration.ts` 实现 `runMigration()`：检测 localStorage 中旧格式 Device（含 brokerUrl 字段）→ 提取唯一 Broker 配置生成 MqttServer → Device 剥离连接字段绑定 serverId → 写入新 keys → 删除旧 key
- [ ] 迁移逻辑在 App 入口处（挂载前）调用，仅执行一次
- [ ] Migration 单元测试：旧格式→新格式转换、重复 Broker 去重、幂等性（二次执行不重复迁移）、空数据/损坏数据处理

## Blocked by

None — can start immediately
