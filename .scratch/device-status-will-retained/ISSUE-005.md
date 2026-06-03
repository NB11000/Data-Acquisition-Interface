# Slice 5: Mock 生成器适配

> **标签**: needs-triage
> **日期**: 2026-06-03

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

[Implementation Plan](IMPLEMENTATION-PLAN.md)

## What to build

**Mock 生成器改造**（`src/mock/useMockGenerators.ts`）：

当前行为：服务器连接时通过 `pool.injectMessage` 注入 `$SYS/brokers/{node}/clients/{clientId}/connected` 消息 → 触发 router $SYS handler → deviceStore.setOnline

新行为：服务器连接时为每台已注册设备注入 `events/will` retained 风格消息：

1. 注入 topic：`daq/{machineId}/events/will`
2. 注入 payload（`DeviceStatusPayload` 格式）：
   ```json
   {
     "status": "online",
     "ts": <Date.now()>,
     "eventType": "device_online",
     "source": "device",
     "message": "设备已上线",
     "timestamp": "<当前 UTC ISO 8601>"
   }
   ```
3. 遍历 `deviceStore.getState().devices` 中 `serverId` 匹配的每台设备，各注入一条
4. 移除对旧 $SYS topic 的注入逻辑

**MockMqttClient 验证**（`src/mqtt/mockClient.ts`）：本 Slice 不修改，仅验证现有 injectMessage → connect → subscribe 流程中 retained 消息的传递语义是否正确（Slice 3 的 router handler 能正确接收并被调用）。

**手动验证**：`pnpm dev`（mock 模式）→ 确认侧边栏设备显示绿色在线态。

## Acceptance criteria

- [ ] Mock 模式下服务器连接后，已注册设备收到 `events/will` online 消息
- [ ] 侧边栏显示绿色在线态
- [ ] 不再注入 $SYS topic 消息
- [ ] `pnpm build` 类型检查通过
- [ ] `pnpm dev` mock 模式下设备在线状态正确

## Blocked by

ISSUE-001, ISSUE-004
