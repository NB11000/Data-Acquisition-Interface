# ISSUE-003: ConfigModal 组件骨架 — Modal + Tabs 框架

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

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

ConfigModal 组件基础骨架：

- `ConfigModalProps { open: boolean; onClose: () => void }`
- Ant Design `<Modal>` 包裹，标题"设备参数配置"，宽度 600px，`destroyOnClose`，`footer={null}`
- Ant Design `<Tabs>` 四个 TabPane：采集卡 / 激光雷达 / 算法参数 / 持久化
- 四个独立的 `<Form>` 实例（每个Tab一个 form instance）
- 暂不实现加载/读取/保存逻辑，仅框架和静态 Tab 内容

CSS Module：`ConfigModal.module.css`，Tabs 内容区最小高度 300px。

## Acceptance criteria

- [ ] Modal 可通过 `open` prop 控制显隐
- [ ] 点击 X / 遮罩 / 取消 触发 `onClose`
- [ ] 四个 Tab 可正常切换，各自独立渲染
- [ ] 每个 Tab 内含 Ant Design Form 组件（表单字段占位）
- [ ] 关闭后 `destroyOnClose` 生效（内部状态销毁）

## Blocked by

ISSUE-002（需要类型和常量定义）
