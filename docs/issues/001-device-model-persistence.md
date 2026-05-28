# Issue 001: Device 模型扩展 + localStorage 持久化

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

1. `utils/devicePersistence.ts` — localStorage 读写模块
2. 扩展 `stores/deviceStore.ts` 中 `Device` 接口至 10 字段
3. `deviceStore` 初始化时调用 `hydrateFromStorage()` 从 localStorage 恢复设备列表
4. 每次设备增删改后自动调用 `saveDevices()` 持久化

## Acceptance criteria

- [ ] Device 类型包含 10 个字段: id, name, brokerUrl, port, username, password, tls, caCert, clientCert, clientKey, isOnline
- [ ] `devicePersistence.saveDevices()` 能将设备列表写入 localStorage
- [ ] `devicePersistence.loadDevices()` 能从 localStorage 读取并正确反序列化
- [ ] `deviceStore` 构造后自动从 localStorage 恢复设备列表（hydrate）
- [ ] 新增、编辑、删除设备后 localStorage 自动同步
- [ ] localStorage 中无数据时返回空数组（首次使用）

## Blocked by

None — 可立即开始
