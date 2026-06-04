# PRD: 设备参数配置弹窗

> **状态**: needs-triage
> **日期**: 2026-06-04
> **基于**: MQTT主题文档 §2.5 系统配置更新

## Problem Statement

当前前端可以对设备下发控制命令（打开采集卡、开始采集、连接激光器、开关激光），但无法查看或修改设备运行参数。用户只能通过后端直接操作配置文件才能调整采集卡量程、激光功率、算法系数等参数，操作路径长、效率低，且缺乏前端校验和即时反馈。

## Solution

在数据中心右侧主内容区顶部状态栏（StatusControlBar）Row2 最右侧新增"设置参数"按钮，点击后弹出配置界面模态框。模态框通过 Tabs 分页组织四个配置类别：采集卡、激光雷达、算法参数、持久化。打开时并发读取四项当前配置填充表单，各 Tab 独立保存，通过现有的 RPC 通信框架下发更新命令。

## User Stories

1. As an 运维人员, I want to see the current CaptureCard settings (sync channel, sample rate, clock source, etc.) in a form, so that I can verify the hardware is configured correctly without accessing the backend.
2. As an 运维人员, I want to modify the sample rate or trigger source, so that I can adapt to different measurement scenarios.
3. As an 运维人员, I want to adjust laser power and modulation frequency, so that I can calibrate the laser for different atmospheric conditions.
4. As an 运维人员, I want to configure the serial port and baud rate of the laser, so that I can switch physical connections without backend access.
5. As an 数据分析员, I want to tune algorithm parameters (gain coefficient, K constant, aperture diameter, path length, etc.), so that I can refine the Cn² calculation accuracy.
6. As an 系统管理员, I want to change the data persistence directory, so that collected data is stored where I need it.
7. As a user, I want each configuration section to save independently, so that a failed save in one category doesn't block me from saving changes in another.
8. As a user, I want to see which configuration sections failed to load, with a retry button, so that I can recover from transient network issues without closing the dialog.
9. As a user, I want input validation (range limits, required fields, type checking) before I hit save, so that I catch configuration errors immediately rather than waiting for a backend rejection.
10. As a user, I want the settings button to be naturally positioned alongside the existing hardware control buttons, so that I can find it without searching.

## Implementation Decisions

### 按钮

- 放在 StatusControlBar Row2 最右侧，作为第三个操作组
- 样式与现有按钮一致：`<Button size="small" icon={<SettingOutlined />}>设置参数</Button>`，不设 type
- 仅在设备已选中且 MQTT 已连接时可点击（复用现有 `allDisabled` 逻辑）

### 模态框

- 声明式 Ant Design `Modal`，props 为 `{ open, onClose }`
- 位于 `src/pages/Dashboard/components/ConfigModal.tsx`
- 标题：设备参数配置
- 宽度：600px，`destroyOnClose`

### 四个配置 Tab

| Tab | RPC 读 | RPC 写 | 字段数 |
|-----|--------|--------|--------|
| 采集卡 | `collector-config-read` | `collector-config-update` | 7 (含 deviceId) |
| 激光雷达 | `laser-config-read` | `laser-config-update` | 4 |
| 算法参数 | `lidar-config-read` | `lidar-config-update` | 11 |
| 持久化 | `persistence-config-read` | `persistence-config-update` | 1 |

每个 Tab 包含独立的 Ant Design `Form`，底部各有一个"保存"按钮。保存成功后显示 success message；失败显示 error message。

### 数据流

1. 打开弹窗 → 并发调 4 个 RPC read 命令（`Promise.allSettled`）
2. 成功的 fill 对应 Tab 表单；失败的 Tab 显示 Spin 转 Error + 重试按钮
3. 用户编辑 → 点击某 Tab 保存 → 调对应 RPC update 命令，payload 为表单值 JSON
4. 保存成功 → message.success；失败 → message.error

### RPC 响应格式

- 扩展 `CommandResult` 类型，新增 `data?: unknown` 字段
- 配置读响应格式：`{ success: true, code: "OK", data: { ...配置对象 } }`
- 配置写响应格式：同上，`data` 含回显的更新后配置
- Mock 模式：在 `mockRpc.ts` 补齐 9 个配置方法的 mock 分支

### 下拉选项

全部硬编码为常量数组，不通过 RPC 动态获取：

| 字段 | 候选值 |
|------|--------|
| syncChannelIndex | 通道1(0), 通道2(1), 双通道(2) |
| clockSourceIndex | 内时钟(0), 外时钟(1) |
| halfFullThreshold | 2M(0) ~ 16K(7) |
| triggerSourceIndex | 外触发(0), 软触发(1) |
| rangeIndex | ±5V(0), ±10V(1) |
| baudRate | 常用波特率列表 |

### 表单校验

使用 Ant Design `Form.Item` 的 `rules` 属性：
- `InputNumber` 字段：`{ required: true, type: 'number', min, max }`
- `Select` 字段：`{ required: true }`
- `Input` 字段（serialPort, dataDirectory）：`{ required: true }`

### 状态管理

表单状态使用组件内 `useState`，不引入新的 Zustand store。弹窗关闭后状态销毁，下次打开重新读取。

### 不使用 collector-config-default

虽有此 RPC 方法，但本次不做"恢复默认值"功能。其他三类配置无对应 default 方法，引入不对称功能会困惑用户。

## Testing Decisions

### 必须测试

- **ConfigModal 组件**：RPC 读取成功/失败/部分失败场景、表单填充正确性、保存按钮调用正确 RPC 方法、校验规则触发、重试按钮行为

### 测试风格

- 通过公共接口验证行为（props + 用户交互），不耦合实现细节
- Mock `useRpcCommand` hook 返回可控的 RPC 响应
- 使用 `@testing-library/react` 渲染 Modal，验证 Tab 切换、表单字段、按钮交互

### 不测试

- StatusControlBar 新增按钮（trivial JSX）
- `CommandResult.data` 类型扩展（类型系统保证）
- `mockRpc.ts` 的 mock 分支（mock 本身不是生产逻辑）

## Out of Scope

- "恢复默认值"功能（`collector-config-default` RPC 方法保留不用）
- 配置项元数据/取值范围通过 RPC 动态获取（保持硬编码）
- 配置变更历史记录
- 配置导出/导入
- 跨设备配置复制

## Further Notes

- 依赖 MQTT 连接和选中设备（复用现有 `allDisabled` 约束）
- 不依赖新增 Zustand store，完全自包含在 Modal 组件内部
- 未来如需新增配置类型，追加 Tab + 对应 RPC 方法即可，不牵动现有 Tab
