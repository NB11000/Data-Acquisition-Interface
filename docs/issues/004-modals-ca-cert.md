# Issue 004: 手动添加/自动发现弹窗 — CA 证书上传 + 完整配置

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

### ManualAddModal
1. 表单字段调整为：设备名称、MachineId、Broker 地址、端口、用户名、密码、TLS 开关
2. 新增 CA 证书文件上传组件（`.crt` 文件 → FileReader 读取为 PEM 文本）
3. 若 `tls=true`，显示 CA 证书上传区域（必填/可选？根据讨论：提示但允许为空）
4. 若 `tls=false`，表单底部显示黄色警告："未启用 TLS，通信内容可能被窃听"
5. 编辑模式下回显已有值（CA 证书显示"已配置"或"未配置"）

### AutoDiscoverModal
1. 步骤 0 的表单改为完整 Broker 配置：地址、端口、用户名、密码、TLS 开关（无证书上传，扫描阶段证书非必需）
2. 扫描发现的设备添加时继承扫描表单中的全部配置

## Acceptance criteria

- [ ] 手动添加表单包含: name, machineId, brokerUrl, port, username, password, tls, caCert 上传
- [ ] 上传 .crt 文件后，FileReader 正确读取为 PEM 字符串
- [ ] tls=false 时显示非加密警告文字
- [ ] 编辑模式正确回显连接参数
- [ ] 自动发现第一步表单包含完整 Broker 配置
- [ ] 自动发现添加的设备继承扫描表单的 Broker 配置
- [ ] 非 TLS 连接在表单中有视觉警告

## Blocked by

#001 — Device 模型扩展 + localStorage 持久化
