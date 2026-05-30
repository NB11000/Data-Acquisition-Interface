# Issue 4: 添加设备流程

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 4

## What to build

实现 MqttServerModal（添加/编辑服务器表单）和 AddDeviceModal（合并的添加设备模态框：服务器选择、自动发现、手动添加、零服务器引导）。替换现有的 ManualAddModal 和 AutoDiscoverModal。

## Acceptance criteria

- [ ] `src/components/modals/MqttServerModal.tsx`：
  - 表单字段：名称、地址、端口（1883/8883 下拉）、用户名、密码、TLS 开关、CA 证书上传（.crt/.pem → 读文本存 PEM）
  - [测试连接] 按钮：尝试建连 → 成功/失败 toast
  - [保存] 按钮：调用 serverStore.addServer() → 去重检查（同 brokerUrl:port:username 拒绝并提示）→ ConnectionPool.create() → 关闭模态框
  - 编辑模式：回填表单 → 保存走 serverStore.updateServer() → ConnectionPool.update()
- [ ] `src/components/modals/AddDeviceModal.tsx`：
  - 下拉框选择 MqttServer（含 [+ 新增] 按钮 → 打开 MqttServerModal）
  - **服务器列表为空**：自动切换到 MqttServerModal 界面，保存后回到 AddDeviceModal，下拉框自动选中新服务器
  - **自动发现 Tab**：读取 `pool.getOnlineClients(serverId)` → 展示可选列表 → 勾选设备 → [确认添加] → deviceStore.addDevice() + pool.subscribeDevice() → 关闭模态框
  - **手动添加 Tab**：输入 Device ID + 名称 → [添加] → deviceStore.addDevice() + pool.subscribeDevice() → 关闭模态框（不验证设备是否存在）
- [ ] 删除旧的 `ManualAddModal.tsx` 和 `AutoDiscoverModal.tsx`（或标记废弃）
- [ ] 侧边栏或其他入口触发 AddDeviceModal 打开

## Blocked by

Issue 2 (ConnectionPool), Issue 3 (Router+RPC — RPC 路由逻辑就绪)
