# Issue 2: 模态框 UI + 数据迁移 — 删除 port 字段

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

重构 MqttServerModal 表单：删除 port 表单项，brokerUrl 改为完整地址输入（协议前缀 + 端口号双重校验）。AddDeviceModal 服务器选项改为 hover tooltip 显示 URL。迁移逻辑拼接旧 brokerUrl:port 数据。

## Acceptance criteria

- [ ] `MqttServerModal` 删除 `port` Form.Item 及其校验规则
- [ ] brokerUrl 新增端口必填校验：URL 必须匹配 `/:\d+/`，否则提示"请包含端口号，如 mqtts://host.com:8883/mqtt"
- [ ] brokerUrl 删除"禁止含端口"的 validator
- [ ] brokerUrl help text 改为 `"请输入完整 Broker 地址，如 mqtts://host.com:8883/mqtt"`
- [ ] brokerUrl placeholder 改为 `"如：mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883/mqtt"`
- [ ] `handleSave` 构造 data 时删除 `port: values.port`；`findDuplicate` 调用删除 port 参数
- [ ] `handleTest` 调用 `testConnection` 时删除 port 参数，新增 caCert 参数
- [ ] 编辑回填删除 `port: server.port`
- [ ] `AddDeviceModal` serverOptions 改为 `label: s.name, title: s.brokerUrl`
- [ ] `src/mqtt/migration.ts`：迁移时拼接 `brokerUrl + ':' + port`；去重 key 移除 port
- [ ] `src/mqtt/migration.test.ts`：更新所有 port 相关断言；验证迁移后 brokerUrl 含端口号
- [ ] `CONTEXT.md`：MqttServer 接口文档删除 port 字段
- [ ] `pnpm build` 通过

## Blocked by

[Issue 1: 数据模型 + 连接基础设施](./01-data-model-infrastructure.md)
