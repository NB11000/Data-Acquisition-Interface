# Issue 05: UI 适配 — caCert 上传 + 三态状态 + env 清理

**Parent**: [IMPLEMENTATION-PLAN-002](../../../docs/IMPLEMENTATION-PLAN-002.md) — Slice 5
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

表层 UI 改造：

1. **ManualAddModal**: 新增 CA 证书文件上传字段，使用 `<input type="file" accept=".crt,.pem">`，读取为 PEM 字符串存入 `device.caCert`。去掉"测试连接并保存"临时连接逻辑（连接池已覆盖）。TLS 关闭时隐藏 CA 证书字段。

2. **Sidebar/DeviceCard**: 支持三态显示：
   - 在线：绿色
   - 离线：红色
   - 未知（null）：灰色/虚线，可附 tooltip "无法确定状态：Broker 连接失败"

3. **env.ts**: 删除 `BROKER_URL`、`BROKER_USERNAME`、`BROKER_PASSWORD`、`DEFAULT_MACHINE_ID` 导出。仅保留 `MQTT_MODE`。

4. **AutoDiscoverModal**: 暂不处理（后续独立 PRD），可暂时保留现有 stub 或移除引用。

## Acceptance criteria

- [ ] 手动添加表单支持上传 .crt 文件
- [ ] 上传后 CA 证书内容读为 PEM 字符串并存入 device.caCert
- [ ] TLS 开关关闭时 CA 证书字段隐藏
- [ ] 编辑设备时可重新上传 CA 证书（覆盖旧值）
- [ ] 侧边栏设备卡片：在线显示绿色，离线显示红色
- [ ] 侧边栏设备卡片：未知状态显示灰色，hover tooltip 说明原因
- [ ] `isOnline = null` 时卡片不显示为离线（不会误导用户）
- [ ] `.env` 和 `env.ts` 不再包含废弃的 4 个变量

## Blocked by

Issue 04 — useMqttConnect + router 适配

## Comments

