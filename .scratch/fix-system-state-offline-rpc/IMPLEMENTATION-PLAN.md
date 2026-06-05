# Implementation Plan: system-state RPC 触发逻辑修复

> **Parent**: [PRD: system-state RPC 触发逻辑修复](./PRD.md)
> **日期**: 2026-06-04

## Modules

| 模块 | 类型 | 单一职责 |
|------|------|----------|
| `useMqttConnect.ts` | 修改 | system-state RPC 三处触发路径均加 isOnline 门控 + 新增上线补发 Effect |

唯一改动文件，无新增模块。

## Interfaces

### 现有接口不变

`sendStateRpcWithRetry(pool, machineId)` — 签名和行为不变。

`useRpcCommand()` — 不变。

### 新增内部状态

```typescript
const prevOnlineRef = useRef<boolean | null>(null);
```

### 新增 Effect 签名

```typescript
// 依赖: [isOnline, selectedId]
useEffect(() => {
  const prev = prevOnlineRef.current;
  prevOnlineRef.current = isOnline;
  if (!prev && isOnline === true) {
    // 补发 system-state RPC
  }
}, [isOnline, selectedId]);

// 依赖: [selectedId] — 重置 prevOnlineRef
useEffect(() => {
  prevOnlineRef.current = null;
}, [selectedId]);
```

## Data Flow

### 快乐路径：点击在线设备

```
用户点击在线设备
  → setSelected(id)
  → 设备切换 Effect 触发
  → device.isOnline === true ✓
  → 正常发 system-state RPC
  → 按钮解灰
```

### 修复路径：点击离线设备

```
用户点击离线设备（原 Bug 路径）
  → setSelected(id)
  → 清空 stores + 切换订阅（保留）
  → device.isOnline === false ✗
  → 跳过 RPC，更新 prevSelectedRef
  → 等待设备上线
```

### 上线补发路径

```
events/will 收到 status="online"
  → deviceStore.setOnline(id, true, 'device_online')
  → isOnline: false → true
  → 新增 Effect 检测到变化
  → prevOnlineRef.current 不是 true、isOnline 是 true → 触发
  → cancelStateRpcRef 清理旧 RPC
  → sendStateRpcWithRetry(pool, selectedId)
  → 按钮解灰
```

### 上线但不补发路径（已在线设备）

```
用户从在线设备A切换到在线设备B
  → A: isOnline=true, B: isOnline=true
  → 设备切换 Effect 走正常路径（isOnline=true → 发 RPC）
  → 新增 Effect: prevOnline 可能是 true, isOnline=true
  → prev && isOnline === true → 条件不满足，不触发 ✓
```

### 重连路径

```
MQTT 重连成功 state='connected'
  → 检查 selectedId
  → 检查 device.isOnline
  → 在线则发 RPC，离线则跳过（等 will 消息上线后走补发路径）
```

## Key Technical Decisions

| 决策 | 选择 | 理由 | 替代方案 |
|------|------|------|----------|
| 改动范围 | 仅 useMqttConnect.ts | 所有 system-state 触发路径集中于此 | router.ts/StatusControlBar 改（职责分散） |
| 上线检测方式 | useEffect 监听 isOnline | Zustand 响应式订阅天然感知，逻辑内聚 | router 回调（跨模块耦合） |
| 去重机制 | useRef 存 prevOnline + selectedId 变时重置 | 仅在 false→true 瞬间触发一次 | 无去重（可能重复发 RPC） |
| 离线设备处理 | 清 stores + 切订阅照做，跳过 RPC | 用户体验一致，不残留上设备数据 | 全跳过（UI 混淆） |
| 重连路径 | 也加 isOnline 检查 | 三路径行为统一 | 不加（重连时离线设备也发 RPC） |
| 连接入口检查 | 不加，依赖 sendRpcCommand 内置 | 内置已覆盖，不重复写防御 | Effect 入口也查（冗余） |

## Test Strategy

### 必须测试

| 测试场景 | 类型 | 重点 |
|----------|------|------|
| 点击在线设备正常发 RPC | 集成 | 设备切换 Effect + isOnline=true |
| 点击离线设备跳过 RPC | 集成 | 设备切换 Effect + isOnline=false |
| isOnline false→true 触发补发 | 集成 | 新增 Effect 补发逻辑 |
| isOnline true→true 不触发 | 集成 | prevOnlineRef 去重 |
| selectedId 变化重置 prevOnlineRef | 集成 | Effect 依赖切换 |

### 不测试

- sendRpcCommand 内部逻辑（已有独立单元测试）
- router.ts will handler（未改动）
- UI 渲染（未改动）

## Vertical Slice Design

单文件改动，垂直切片极简：

### Slice 1: 设备切换 Effect + isOnline 检查（无阻塞依赖）
- 设备切换 Effect 加 `device.isOnline` 门控
- 断开 RPC 发送路径的设备，清空 + 切主题保留

### Slice 2: 新增 isOnline 监听 Effect + 上线补发
- 依赖 Slice 1（共享 `sendStateRpcWithRetry` 和 `cancelStateRpcRef`）
- isOnline false/null→true 时自动补发 RPC

### Slice 3: 重连路径 + StrictMode 路径加 isOnline 检查
- 依赖 Slice 1-2（行为对齐）
- 两处连接恢复路径加同名门控
