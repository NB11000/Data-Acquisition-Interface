# PRD-001: 设备 MQTT 配置重构

**状态**: Draft
**日期**: 2026-05-28
**标签**: needs-triage

---

## Problem Statement

当前前端存在以下问题：

1. 设备模型仅有 `tls: boolean` 标记，无法存储真实 TLS 连接所需的 CA 证书、客户端证书
2. MQTT 连接参数（brokerUrl / username / password）存储在全局 `.env` 中，不支持不同设备连接不同 Broker
3. MQTT 客户端为全局单例，无法按设备切换连接配置
4. 设备列表刷新即丢失，无持久化机制
5. 自动发现假设所有设备在同一 Broker 下，无法适应多 Broker 场景

## Solution

将 MQTT 连接配置从全局级别下沉到每个 Device 自包含，使每个设备携带完整的 Broker 连接信息（地址、端口、用户名、密码、TLS 开关、CA 证书）。连接管理改为"同一时刻最多一个活跃连接，同 Broker 复用，不同 Broker 重连"。

---

## User Stories

1. As a 运维人员, I want 手动添加设备时填写完整的 MQTT 连接信息（Broker 地址、端口、用户名、密码、TLS 开关、上传 CA 证书文件）, so that 每个设备能独立连接到各自的 Broker
2. As a 运维人员, I want 编辑设备时修改连接参数（含重新上传 CA 证书）, so that 设备迁移到新 Broker 时无需删除重建
3. As a 运维人员, I want 自动发现时输入 Broker 连接信息再扫描, so that 能发现不同 Broker 下注册的设备
4. As a 运维人员, I want 自动发现添加的设备自动继承扫描表单中的 Broker 连接配置, so that 不需要手动逐个填写
5. As a 运维人员, I want 刷新页面后设备列表自动恢复, so that 不需要每次重新添加
6. As a 运维人员, I want 点击不同设备时对比 Broker 地址，同 Broker 则无缝切换，不同 Broker 则断开重连, so that 切换延迟最小化
7. As a 运维人员, I want 编辑已选中设备的连接参数后右下角弹出提示框询问是否重连, so that 我能控制何时应用新配置
8. As a 运维人员, I want 编辑设备名称时不弹出重连提示, so that 纯显示名称的修改不被干扰
9. As a 运维人员, I want Mock 模式下添加设备时同样填写完整连接信息, so that 切换到 Real 模式时配置已就绪
10. As a 运维人员, I want 非 TLS 的 MQTT 连接得到明确的警告提示, so that 我知道连接不安全

---

## Implementation Decisions

### 模块变更

| 模块 | 操作 | 职责 |
|------|------|------|
| `deviceStore` | 修改 | Device 模型扩展 10 个字段；集成持久化（加载/保存） |
| `mqttClient` | 修改 | 单例 → 支持按需创建/断开连接；接收 ca/cert/key 参数 |
| `useMqttConnect` | 修改 | brokerUrl 对比逻辑；编辑后提示重连 |
| `ManualAddModal` | 修改 | 新增 CA 证书文件上传（读为 PEM 字符串）；表单字段调整 |
| `AutoDiscoverModal` | 修改 | 扫描表单继承配置到发现设备；支持指定 Broker 扫描 |
| `devicePersistence` | 新建 | localStorage 读写设备列表 |
| `ReconnectPrompt` | 新建 | 右下角重连确认提示框 |

### 关键接口变更

**Device 模型**：
```typescript
interface Device {
  id: string;            // MachineId
  name: string;          // 显示名称
  brokerUrl: string;     // Broker 地址
  port: number;          // Broker 端口
  username: string;      // 认证用户名
  password: string;      // 认证密码
  tls: boolean;          // 是否启用 TLS
  caCert?: string;       // CA 证书 PEM 内容
  clientCert?: string;   // 客户端证书 (预留)
  clientKey?: string;    // 客户端私钥 (预留)
  isOnline: boolean;     // 运行时状态
}
```

**MqttClientLike 不变**，但 `initMqttClient` 签名改为接收设备完整配置而非仅 clientId。

**切换设备逻辑**：
```
选中 Device A
  → 当前无连接: 创建连接(Device A 配置) → 订阅 A 的所有 topic
  → 当前有连接到 Broker X:
    → Device A 的 brokerUrl === X: 取消旧订阅 → 订阅 A 的 topic (无缝)
    → Device A 的 brokerUrl !== X: 断开旧连接 → 创建新连接 → 订阅 A 的 topic
```

### 环境变量变更

`.env` 文件精简为：
```
VITE_MQTT_MODE=mock|real
VITE_DEFAULT_MACHINE_ID=daq-srv-01
```

删除 `VITE_BROKER_URL`、`VITE_BROKER_USERNAME`、`VITE_BROKER_PASSWORD`。

### 非 TLS 连接警告

若用户添加/编辑设备时 `tls=false`，在表单显示黄色警告文字："未启用 TLS，通信内容可能被窃听"，但不阻止保存。

---

## Testing Decisions

- **测试原则**: 只测试外部行为，不耦合实现细节。使用公共接口验证。
- **优先测试模块**: `devicePersistence`（存储/读取正确性）、`deviceStore`（状态变更正确性）、`mqttClient`（连接/断开/重连行为）
- **参考模式**: 使用 Vitest（项目已安装 vite 生态），参考现有 stores 的 Zustand 单测风格
- **不测试**: 纯渲染组件（Modal 表单 UI 布局）、localStorage 兼容性（浏览器保证）

---

## Out of Scope

- 双向 TLS（clientCert / clientKey）仅预留字段，不实现 UI 和逻辑
- 密码加密存储 — 当前明文存 localStorage，加密方案后续独立 PRD
- 设备导入/导出功能
- Settings 页面改造（超出本 PRD 范围）

---

## Further Notes

- localStorage 明文存储 password 和 caCert 存在安全风险，已告知用户
- 连接管理不使用线程池/连接池，同一时刻最多一条活跃 MQTT 连接
