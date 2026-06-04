# Implementation Plan: 设备参数配置弹窗

> **Parent**: [PRD: 设备参数配置弹窗](./PRD.md)
> **日期**: 2026-06-04

## Modules

| 模块 | 类型 | 单一职责 |
|------|------|----------|
| ConfigModal | 新增组件 | Tabs 分页配置表单、RPC 读写、校验、错误处理 |
| StatusControlBar | 修改组件 | 新增"设置参数"按钮 + open state |
| CommandResult 类型 | 修改类型 | 新增 `data?: unknown` 通用载荷字段 |
| mockRpc | 修改 mock | 补齐 9 个配置方法 mock 响应 |

## Interfaces

### ConfigModal

```typescript
// Props
interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
}

// 内部表单状态（四个独立 useState）
const [collectorForm] = Form.useForm<CaptureCardConfig>();
const [radarForm] = Form.useForm<RadarConfig>();
const [algorithmForm] = Form.useForm<LidarAlgorithmConfig>();
const [persistenceForm] = Form.useForm<PersistenceSettings>();

// 四个 Tab 的加载状态 + 错误状态
const [loadStates, setLoadStates] = useState<Record<string, LoadState>>({
  collector: 'loading',
  radar: 'loading',
  algorithm: 'loading',
  persistence: 'loading',
});
```

**数据形状**：

```typescript
// 配置类型（与 MQTT 文档 §2.5 一致）
interface CaptureCardConfig {
  deviceId: number;
  syncChannelIndex: number;
  sampleRate: number;
  clockSourceIndex: number;
  halfFullThreshold: number;
  triggerSourceIndex: number;
  rangeIndex: number;
}

interface RadarConfig {
  laserPower: number;
  laserModulationFrequency: number;
  serialPort: string;
  baudRate: number;
}

interface LidarAlgorithmConfig {
  gainEqualizationCoefficient: number;
  kConstant: number;
  receiverApertureD_m: number;
  pathLengthL_m: number;
  cn2WindowFrames: number;
  fernaldBoundaryDistance_m: number;
  laserWavelength_nm: number;
  angstromExponent: number;
  darkCurrentSampleCount: number;
  sampleRateHz: number;
  blindZoneDistance_m: number;
}

interface PersistenceSettings {
  dataDirectory: string;
}
```

**加载状态机**：`loading` → 成功时 fill 表单 `idle` / 失败时 `error(idle)`。`error` 态显示重试按钮。

**错误语义**：
- RPC 读取失败 → 对应 Tab 显示错误提示 + 重试按钮，不影响其他 Tab
- RPC 保存失败 → message.error 展示后端返回的 message 字段，表单保持当前值
- RPC 超时 (10s) → 同读取失败处理

### StatusControlBar 变更

```typescript
// 新增 state
const [configModalOpen, setConfigModalOpen] = useState(false);

// 新增 JSX (Row2 最右侧)
<Button
  size="small"
  icon={<SettingOutlined />}
  disabled={allDisabled}
  onClick={() => setConfigModalOpen(true)}
>
  设置参数
</Button>

// 条件渲染
<ConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
```

### CommandResult 类型扩展

```typescript
// src/mqtt/types.ts
export interface CommandResult {
  success: boolean;
  code: string;
  message: string;
  state?: SystemStateDto;
  data?: unknown;  // 新增：配置读写等通用载荷
  timestamp: string;
}
```

不修改 `tryResolveRpc`（JSON.parse 自然兼容多出的字段），不修改 `sendRpcCommand`（签名不变）。

### mockRpc 扩展

在 `handleMockRpc` 的 switch 中补齐 9 个 case：

| method | 行为 |
|--------|------|
| `collector-config-read` | 返回带 `data` 的默认 CaptureCardConfig（不含 deviceId，保持已设值0或模拟值） |
| `collector-config-update` | 回显 payload 到 `data` |
| `collector-config-default` | 返回硬编码默认 CaptureCardConfig |
| `laser-config-read` | 返回默认 RadarConfig |
| `laser-config-update` | 回显 payload |
| `lidar-config-read` | 返回默认 LidarAlgorithmConfig |
| `lidar-config-update` | 回显 payload |
| `persistence-config-read` | 返回默认 PersistenceSettings |
| `persistence-config-update` | 回显 payload |

## Data Flow

### 快乐路径

```
用户点击"设置参数"
  → setConfigModalOpen(true)
  → ConfigModal mount, useEffect 触发
  → Promise.allSettled([collectorRead, laserRead, lidarRead, persistenceRead])
  → 全部成功: 四个 Form.setFieldsValue 填充表单数据
  → 用户编辑某 Tab → 点击"保存"
  → Form.validateFields() → 通过
  → sendCommand("xxx-config-update", formValues)
  → RPC 成功 → message.success("保存成功")
  → RPC 失败 → message.error(result.message)
```

### 错误路径

```
Promise.allSettled 中某方法 reject
  → 该 Tab 的 loadState 置为 'error'
  → 显示 Error Alert + "重试"按钮
  → 用户点击重试 → 重新调该读方法 → 成功 fill / 失败继续 error
```

### 关闭/重开路径

```
用户关闭弹窗
  → Modal destroyOnClose
  → 所有 useState 销毁
  → 下次打开重新并发读取（保证数据最新）
```

### 边界条件

- 弹窗打开过程中 MQTT 断开：RPC 直接 reject CONNECTION_LOST，Tab 显示 error，不可保存
- selectedId 变化（切换设备）：需关闭弹窗或重新读取？**选择不做特殊处理**——弹窗打开期间切换设备概率极低，关闭后重开自然读到新设备配置
- 打开弹窗前 `allDisabled` 已为 true：按钮 disabled，弹窗无法打开

## Key Technical Decisions

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|----------|
| 状态管理 | 组件内 useState | 配置数据无需跨组件共享 | Zustand store（过度工程） |
| 读取策略 | 打开时并发全读 | 用户切Tab立即可见值 | 切Tab时懒加载（卡顿） |
| 保存策略 | 每Tab独立保存 | 独立故障域，不互相阻塞 | 统一保存按钮（耦合） |
| 下拉选项 | 前端硬编码 | 文档已列全取值范围 | RPC动态获取（无对应接口） |
| RPC响应格式 | 扩展CommandResult.data | 复用现有RPC管道，改动最小 | 独立请求机制（双链路） |
| 错误处理 | Tab级降级+重试 | 部分失败不阻碍其他Tab | 全量失败（用户体验差） |
| 表单校验 | Ant Design Form rules | 即时反馈，零额外代码 | 仅后端校验（等待长） |
| 默认值功能 | 不做 | 仅采集卡有后端支持，不对称 | 部分硬编码（维护负担） |
| 组件位置 | Dashboard/components/ | 页面级专属，就近引用 | components/modals/（全局污染） |

## Test Strategy

### ConfigModal 测试

| 测试场景 | 类型 | 重点 |
|----------|------|------|
| 打开弹窗后四个Tab均加载成功 | 集成 | 验证并发读取、表单填充正确性 |
| 某个Tab读取失败，其他正常 | 集成 | 验证部分失败降级、error显示、重试按钮 |
| 全部读取失败 | 集成 | 验证全局错误处理 |
| 编辑字段后保存成功 | 集成 | 验证RPC调用 method 和 payload |
| 保存失败显示错误消息 | 集成 | 验证后端 error message 展示 |
| 点击重试后成功加载 | 集成 | 验证重试逻辑 |
| 必填字段校验 | 集成 | 验证 Form rules |
| Tab切换 | 集成 | 验证 activeKey 切换 |

### 不测

- StatusControlBar 按钮渲染（纯 JSX 无逻辑）
- CommandResult 类型扩展（TypeScript 编译期保证）
- mockRpc mock 分支（mock 代码本身非生产逻辑）

## Vertical Slice Design

### Slice 1: RPC 层准备（无阻塞依赖，可立即开始）
- 扩展 `CommandResult.data`
- 补齐 `mockRpc.ts` 9 个配置方法
- **依赖**: 无
- **修改**: `src/mqtt/types.ts`, `src/mock/mockRpc.ts`

### Slice 2: 配置类型定义 + 下拉常量（无阻塞依赖，可立即开始）
- 定义四种配置 TypeScript 接口
- 定义下拉选项常量数组
- **依赖**: Slice 1（引用 `CommandResult` 类型）
- **新增**: `src/pages/Dashboard/components/ConfigModal.tsx`（仅类型+常量部分）

### Slice 3: ConfigModal 组件骨架（依赖 Slice 1-2）
- Modal + Tabs 框架、Tab 切换、loading 状态
- **依赖**: Slice 1, Slice 2
- **新增**: ConfigModal.tsx（框架部分）

### Slice 4: 配置读取功能（依赖 Slice 3）
- 打开弹窗并发调 4 个 RPC read
- 表单填充、错误降级、重试
- **依赖**: Slice 3
- **修改**: ConfigModal.tsx（读取逻辑）

### Slice 5: 配置保存功能（依赖 Slice 4）
- 每个Tab独立表单 + 保存按钮
- 校验 + RPC 写入 + 消息提示
- **依赖**: Slice 4
- **修改**: ConfigModal.tsx（保存逻辑）

### Slice 6: 按钮集成（依赖 Slice 5）
- StatusControlBar 新增"设置参数"按钮 + open state + ConfigModal 条件渲染
- **依赖**: Slice 5
- **修改**: `src/pages/Dashboard/StatusControlBar.tsx`
