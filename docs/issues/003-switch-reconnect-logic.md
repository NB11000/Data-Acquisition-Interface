# Issue 003: 设备切换 brokerUrl 对比 + ReconnectPrompt 组件

**标签**: needs-triage
**父文档**: [IMPLEMENTATION-PLAN-001](../IMPLEMENTATION-PLAN-001.md)

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

1. 修改 `hooks/useMqttConnect.ts` — 切换设备时对比 brokerUrl：
   - 相同 → 不变更连接，仅切换 topic 订阅
   - 不同 → 调用 `destroyCurrentClient()` 断开旧连接 → `initMqttClient(device)` 新建连接 → 订阅
2. 新建 `components/ReconnectPrompt.tsx` — 右下角浮层提示组件：
   - 当编辑已选中设备的连接参数（非名称）后显示
   - 用户点击"确认重连" → 断开旧连接重建
   - 用户点击"忽略" → 维持当前连接
3. `deviceStore` 新增 `hasConnectionChanged(id, prev, next)` 辅助方法

## Acceptance criteria

- [ ] 选中的两个设备 brokerUrl 相同时，MQTT 连接不重建，仅切换 topic 订阅
- [ ] 选中的两个设备 brokerUrl 不同时，旧连接断开，新连接建立并订阅
- [ ] 编辑已选中设备的连接参数后，ReconnectPrompt 显示在右下角
- [ ] ReconnectPrompt 需要"设备名称变更"时**不**弹出
- [ ] 用户点击确认 → 断开重连
- [ ] 用户点击忽略 → 连接不变
- [ ] 连接切换过程中 Store 的数据被正确重置

## Blocked by

#002 — MQTT 客户端重构
