# 提交记录

> 生成时间：2026-06-04 00:15
> 仓库：数据采集与检测系统 V2.0
> 分支：`master`

---

## 一、背景（Background）

设备在 MQTT 后台显示在线、前端连接正常，但顶部状态栏四个按钮始终置灰。经过逐层排查，发现根因链有四个环节全部阻断。

### 问题（Problem）

#### 1. RPC 发送时机过早

`useMqttConnect` 初始化 effect 在 `pool.create()` 之后立即发送 `system-state` RPC，此时 MQTT 连接尚未就绪（async），被 `sendRpcCommand` 的连接检查立即拒绝："服务器未连接"。重试仅一次，若连接未在 3s 内建立则永久失败。

#### 2. RPC 方法名大小写不匹配

前端发送 `SYSTEM_STATE`（大写+下划线），设备注册的是 `system-state`（小写+连字符）。设备日志："RPC 方法未注册: SYSTEM_STATE"。

#### 3. RPC 响应 JSON 结构不兼容

设备返回 `{ collector: {...}, laser: {...}, ... }`（扁平 SystemStateDto），前端取 `result.state.collector`（期望 CommandResult 嵌套结构）。`result.state` 永远是 `undefined`，`applyState` 从未被调用。

#### 4. 错误静默吞没

三处 RPC 调用均 `.catch(() => {})`，所有失败对开发者不可见。

---

## 二、解决方案（Solution）

### 整体思路

将 RPC 触发从 React effect 生命周期改为 MQTT 连接事件驱动，统一方法名为 `system-state`，兼容扁平/嵌套两种 JSON 响应格式，添加控制台日志和自动重试。

### 具体实施

#### 1. RPC 延迟到 MQTT connected 事件

`onStateChange('connected')` 回调中为当前选中设备订阅主题 + 发送 RPC。每次连接（含断连重连）都自动拉取最新设备状态。StrictMode 重挂载时通过 `cancelStateRpcRef` 去重兜底。

#### 2. RPC 失败日志 + 3s 自动重试

提取 `sendStateRpcWithRetry()` 函数：首次失败 → `console.warn` → 3s 后重试一次 → 仍失败则 `console.error`。返回 cancel 函数供设备切选/清理时取消。设备切选时先取消旧 RPC 再发起新 RPC。

#### 3. `SYSTEM_STATE` → `system-state`

涉及 `useMqttConnect.ts`、`mockRpc.ts`、`router.test.ts`、`rpc.test.ts` 共 4 个文件。

#### 4. RPC 响应兼容扁平格式

`result.state ?? result` 回退：优先取 `result.state`（CommandResult 包装），不存在则取 `result` 直接（设备原样返回的 SystemStateDto）。

---

## 三、Git 提交消息

```
fix(mqtt): 修复 RPC 时序/方法名/解析三处问题，按钮解灰
```

**正文：**

1. RPC 从 init effect 即时发送改为 MQTT connected 事件驱动，杜绝连接未就绪时被拒
2. SYSTEM_STATE 统一改为 system-state 匹配设备端注册的方法名
3. RPC 响应解析兼容扁平格式（result.state ?? result），设备直接返回的 collector/laser 可正确应用
4. 新增控制台日志（成功/失败/重试）与 3s 自动重试机制，替代静默吞错
5. Mock 端同步更新方法名和测试断言

---

## 四、本次提交详情

### 基本信息

| 字段 | 内容 |
|------|------|
| **提交时间** | 2026-06-04 00:15:00 |
| **作者** | NB11000 |
| **提交哈希** | `<待生成>` |
| **基于提交** | `fbda1f5` — fix(mqtt): 修复自动发现死循环及手动添加设备无法订阅主题 (2026-06-03 22:50) |
| **变更统计（核心 4 文件）** | 4 files changed, +74 insertions(+), -26 deletions(-) |

### 核心变更文件清单

| 状态 | 文件路径 | 变更说明 |
|------|----------|----------|
| 修改 | `src/hooks/useMqttConnect.ts` | RPC 时序重构 + 重试 + 扁平解析 + 日志（+65/-23） |
| 修改 | `src/mock/mockRpc.ts` | switch case 和 state_changed 注入判断方法名更新（+2/-2） |
| 修改 | `src/mqtt/router.test.ts` | 测试 topic 方法名更新（+1/-1） |
| 修改 | `src/mqtt/rpc.test.ts` | 测试 RPC 调用参数更新（+3/-3） |

---

## 五、架构影响

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| RPC 触发时机 | init effect 同步调用 | MQTT `connected` 事件驱动 |
| 方法名 | `SYSTEM_STATE` | `system-state` |
| 响应解析 | 仅支持 `result.state.collector` | `result.state ?? result` 双格式兼容 |
| 错误处理 | `.catch(() => {})` 静默 | `console.warn/error` + 3s 自动重试 |

---

## 六、审核报告

> 审查范围：`src/hooks/useMqttConnect.ts`、`src/mock/mockRpc.ts`、`src/mqtt/router.test.ts`、`src/mqtt/rpc.test.ts`

### 通过项

| # | 检查点 | 详情 |
|---|--------|------|
| 1 | 测试全绿 | 12 测试文件 / 77 条测试全部通过 |
| 2 | 类型检查 | tsc 编译无错误 |
| 3 | 构建验证 | vite build 成功 |
| 4 | 兼容现有代码 | state_changed router 处理不受影响，Mock 模式完整兼容 |

---

## 七、后续步骤预览（不在本次范围）

- 设备端修复 RPC 响应反馈死循环（`/response` 递归追加导致断连）
- antd 6 弃用 API 迁移（`destroyOnClose` → `destroyOnHidden`、`Alert message` → `title` 等）
