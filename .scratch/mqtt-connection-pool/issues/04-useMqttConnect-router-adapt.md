# Issue 04: useMqttConnect + router 适配连接池

**Parent**: [IMPLEMENTATION-PLAN-002](../../../docs/IMPLEMENTATION-PLAN-002.md) — Slice 4
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

将 `useMqttConnect` 重写为连接池编排层：初始化时调用 `connectionPool.init()`，设备选中变化时调用 `connectionPool.switchSelection()`。同时改造 `router.ts`，使每条连接独立注册 `onMessage`（由 ConnectionPool 在创建连接时配置）。

具体变更：
- `useMqttConnect` 不再直接操作 MQTT client 单例
- 改为在 useEffect 中调用 `connectionPool.init(devices)`（仅一次）
- 选中设备变化时调用 `connectionPool.switchSelection(oldId, newId)`
- 为连接池暴露设备在线状态回调（`$SYS` 消息 → `deviceStore.setOnline`）
- `router.ts` 中 `setupMqttRouter` 函数体可复用，但改为由 ConnectionPool 创建连接时调用
- Mock 模式生成器逻辑适配：通过 `connectionPool.getConnection(machineId)` 获取对应 MockClient

## Acceptance criteria

- [ ] 页面加载时自动初始化连接池并订阅所有设备常驻主题
- [ ] `$SYS` 消息正确更新设备在线/离线状态（Mock 模式可验证）
- [ ] 点击侧边栏切换设备时，UI 显示当前设备的波形/低频数据
- [ ] 旧设备的跟随主题在切换后不再推送数据
- [ ] Mock 模式下设备切换时波形数据正确切换到新设备
- [ ] 连接失败时错误 toast 弹出，侧边栏显示"未知"
- [ ] StrictMode 双重挂载下不创建重复连接
- [ ] 不再有全局 `VITE_BROKER_URL` 等 env 依赖

## Blocked by

Issue 03 — ConnectionPool 内核

## Comments

