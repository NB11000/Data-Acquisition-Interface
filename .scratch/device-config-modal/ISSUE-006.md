# ISSUE-006: 按钮集成 — StatusControlBar 新增"设置参数"入口

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

在 StatusControlBar 中集成配置弹窗入口：

1. **Button**：放在 Row2 最右侧（采集卡/激光器按钮组之后），`<Button size="small" icon={<SettingOutlined />}>设置参数</Button>`
2. **Disabled 逻辑**：复用现有 `allDisabled` — MQTT 断开 / will 崩溃 / 未选中设备 / 未连接时按钮置灰
3. **Open state**：`const [configModalOpen, setConfigModalOpen] = useState(false)`
4. **Modal 渲染**：在 StatusControlBar return 的底部条件渲染 `<ConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />`
5. **导入**：`import ConfigModal from './components/ConfigModal'`，`import { SettingOutlined } from '@ant-design/icons'`

## Acceptance criteria

- [ ] Row2 最右侧显示"设置参数"按钮，与采集卡/激光器按钮风格一致
- [ ] MQTT 断开时按钮 disabled
- [ ] 未选中设备时按钮 disabled
- [ ] 正常状态点击按钮弹出配置弹窗
- [ ] 关闭弹窗后按钮可再次点击打开
- [ ] 切换设备后重新打开弹窗能读到新设备配置

## Blocked by

ISSUE-005（ConfigModal 需完整可用）
