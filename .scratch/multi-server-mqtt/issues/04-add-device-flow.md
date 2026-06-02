# Issue 4: 添加设备流程

## Execution Rules

> **此 Issue 为 UI 组件实现，不适用 TDD 流程。** 实现完成后通过手动验证确认 Acceptance Criteria。
>
> - MqttServerModal 和 AddDeviceModal 依赖 Ant Design 组件（Modal/Form/Select/Tabs），单元测试成本高收益低
> - 核心业务逻辑（ConnectionPool.subscribeDevice、serverStore.addServer）已在 Issue 2 通过测试验证
> - 验证方式：浏览器中打开模态框，完成添加服务器 → 自动发现设备 → 手动添加设备 的完整流程

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
