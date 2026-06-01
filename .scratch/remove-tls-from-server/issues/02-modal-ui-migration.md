# Issue 2: 模态框 UI + 数据迁移 — 删除 tls 字段

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

重构 MqttServerModal 表单，删除 tls Form.Item，改为 UI-only TLS 开关（自动跟随 brokerUrl 前缀、控制 CA 证书上传启用/禁用）。brokerUrl 新增校验规则（必须有协议前缀、禁止含端口）。port 改为必填无默认值。更新迁移逻辑，将旧数据的 `tls` 标志转换为 brokerUrl 协议前缀。

## Acceptance criteria

- [ ] MqttServerModal 删除 `tls` Form.Item（Switch）及 initialValues 中的 `tls: false`
- [ ] 新增 UI-only 状态 `tlsEnabled`，通过监听 brokerUrl 值自动切换（`mqtts://` → ON，其他 → OFF）
- [ ] CA 证书 Upload 组件 `disabled={!tlsEnabled}`
- [ ] brokerUrl validator：必填 + 正则 `/^mqtts?:\/\/.+/`（必须以 mqtt:// 或 mqtts:// 开头）+ 禁止包含端口（检测 `:\d+`，提示"端口请填写在下方端口号字段"）
- [ ] brokerUrl help text 改为："请包含协议前缀并去掉端口，如 mqtts://host.com"
- [ ] port 删除默认值（initialValues 中移除 port），规则保持不变（必填，1-65535）
- [ ] `handleSave` 组装的 data 对象删除 `tls` 字段
- [ ] `handleTest` 调用 `testConnection` 时删除 `tls` 参数
- [ ] `src/mqtt/migration.ts`：UniqueBroker 接口删除 `tls`；迁移生成 MqttServer 时根据旧 `tls` 给 brokerUrl 补 `mqtt://` 或 `mqtts://` 前缀（已有前缀则跳过）；`extractUniqueBrokers` 删除 `tls` 字段
- [ ] `src/mqtt/migration.test.ts`：删除所有 `tls` 断言；验证迁移后 brokerUrl 正确包含协议前缀；验证已有前缀不被重复添加
- [ ] 编辑模式回显：TLS 开关根据 `server.brokerUrl` 初始化

## Blocked by

[Issue 1: 数据模型 + 连接基础设施](./01-data-model-infrastructure.md)
