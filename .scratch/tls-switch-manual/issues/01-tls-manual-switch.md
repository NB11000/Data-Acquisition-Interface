# Issue 1: TLS 开关手动控制 + 扩展协议前缀

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md)

## What to build

修改 `MqttServerModal.tsx` 中 TLS 开关的行为：
1. TLS Switch 改为手动控制（移除 `disabled`，移除自动跟随 brokerUrl 的 `useWatch` + `useEffect`）
2. 编辑模式根据 `caCert` 是否存在初始化 TLS 开关
3. brokerUrl 前缀校验扩展为四种：`mqtt://`、`mqtts://`、`ws://`、`wss://`
4. `handleSave` 增加双向一致性校验

## Acceptance criteria

- [ ] TLS Switch 移除 `disabled` 属性，用户可手动开关
- [ ] 删除 `Form.useWatch('brokerUrl')` 及对应的自动同步 `useEffect`
- [ ] 新建模式 TLS 开关初始为 OFF
- [ ] 编辑模式：`server.caCert` 非空 → TLS ON；`server.caCert` 为空 → TLS OFF
- [ ] brokerUrl prefix regex 改为 `/^(mqtts?|wss?):\/\/.+/`
- [ ] CA 证书 Upload `disabled={!tlsEnabled}`
- [ ] `handleSave` 增加校验：TLS ON + URL 不以 `mqtts://` 或 `wss://` 开头 → `message.warning("TLS 已开启，Broker 地址必须以 mqtts:// 或 wss:// 开头")` 并 return
- [ ] `handleSave` 增加校验：TLS OFF + URL 不以 `mqtt://` 或 `ws://` 开头 → `message.warning("TLS 未开启，Broker 地址必须以 mqtt:// 或 ws:// 开头")` 并 return
- [ ] 提示文字 "根据 Broker 地址自动识别" 删除

## Blocked by

None — can start immediately
