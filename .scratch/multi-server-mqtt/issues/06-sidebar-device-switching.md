# Issue 6: 侧边栏 + 设备切换

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 6

## What to build

改造侧边栏为按 MqttServer 分组的设备树（可折叠/展开、全局搜索、在线状态图标）。改造 useMqttConnect Hook 支持连接池初始化和设备切换时的跟随主题管理（同服务器复用、跨服务器切换连接）。

## Acceptance criteria

- [ ] `src/components/sidebar/index.tsx` 改造：
  - 设备按 MqttServer 分组展示（树形结构）：服务器节点（可展开/折叠，默认展开）+ 缩进的 Device 节点
  - 服务器节点显示名称 + 连接状态图标（绿点/灰点/红点/黄点）
  - 连接断开的服务器节点灰显，其下 Device 全部显示"未知"图标
  - Device 节点显示名称 + 在线状态图标（绿点/灰点/未知图标）+ 选中高亮
  - 搜索框：输入搜索词 → 匹配的 Device 高亮 + 所属服务器自动展开；无匹配的服务器节点隐藏；清空恢复完整树
  - 点击 Device → deviceStore.setSelected(id)
- [ ] `src/hooks/useMqttConnect.ts` 改造：
  - **初始化**：从 serverStore 读取所有 server → 并行 pool.create()；订阅 `pool.onMessage` → router 分发
  - **设备切换监听**：watch `selectedId` 变化 → 判断新旧 Device 的 serverId
    - 同 serverId：`pool.unsubscribeDevice(oldId, following)` + `pool.subscribeDevice(newId, following)`，复用连接
    - 跨 serverId：源连接保留（不销毁），取消旧跟随主题（若连接 alive）；目标连接订阅新跟随主题
  - **跟随主题管理**：仅管理波形/ch1、波形/ch2、lowfreq、detection/alerts 四个跟随主题
  - 切换设备时清空 dataStore/waveformStore/alarmStore（保持现有行为）
  - 移除所有 `if (MQTT_MODE === 'real')` 订阅分支，统一走 pool
- [ ] Device 切换时处理竞态：重连期间切换设备，unsubscribe 检查连接 alive 决定是否调用

## Blocked by

Issue 5 (Settings — sidebar 引用相同的 serverStore), Issue 3 (Router+RPC)
