# 提交记录

> 生成时间：2026-06-02
> 仓库：数据采集与检测系统 V2.0
> 分支：`dev`

---

## 一、背景（Background）

当前 MqttServer 表单将 Broker 地址拆分为 `brokerUrl`（主机+协议前缀）和 `port`（端口号）两个独立字段，导致用户体验差、数据冗余。同时 `testConnection` 和 `connectionFactory` 中 caCert 链路断裂，TLS 场景下测试连接与真实连接不可靠。

### 问题（Problem）

#### 1. 用户需手动拆分完整 URL

从 EMQX 控制台复制的连接地址为完整格式（如 `mqtts://host.com:8883/mqtt`），用户不得不手动拆分到 brokerUrl / port 两个字段，操作繁琐。

#### 2. 端口作为独立字段存储带来不一致风险

`brokerUrl` 和 `port` 分别存储后再拼接使用，数据源重复，可能出现 URL 中已有端口但 port 字段又被单独修改导致不一致。

#### 3. MqttServerModal 表单字段过多

6 个字段（name / brokerUrl / port / username / password / TLS），认知负担偏重。

#### 4. testConnection 和 connectionFactory 中 caCert 链路断裂

`testConnection` 签名不传递 CA 证书，`connectionFactory.createConnection` 未将 `caCert` 传入 `mqtt.connect()` 的 TLS 选项，TLS 场景下测试连接和实际建连都不可靠。

---

## 二、解决方案（Solution）

### 整体思路

将 `brokerUrl` 和 `port` 合并为单一字段，用户直接输入完整 Broker 连接地址；同步修复 caCert 在连接工厂和测试连接中的缺失链路。

### 具体实施

#### 1. 数据模型简化——删除 `port` 字段

- `serverStore.ts` 的 `MqttServer` 接口删除 `port: number`
- `mqtt/types.ts` 的 `MqttServer` 接口同步删除 `port: number`
- `findDuplicate` 签名从 `(brokerUrl, port, username)` 简化为 `(brokerUrl, username)`
- `brokerUrl` 改为完整地址（协议+主机+端口+路径），如 `mqtts://host.com:8883/mqtt`

#### 2. 连接基础设施适配

- `connectionFactory.ts`：不再拼接 `${brokerUrl}:${port}`，直接透传 `server.brokerUrl`；补充 `ca` 和 `rejectUnauthorized` TLS 选项传入 `mqtt.connect()`
- `connectionPool.ts`：`needsReconnect` 判断不再比较 `port` 字段
- `pool.ts`：`testConnection` 签名从 `(brokerUrl, port, username, password)` 变为 `(brokerUrl, username, password, caCert?)`

#### 3. MqttServerModal 表单 UI 重构

- 删除端口号 `InputNumber` 表单项及其校验规则
- brokerUrl 校验改为：不允许不含端口号的 URL（validator 检查 `:\d+`）
- help text 更新为"请输入完整 Broker 地址，如 mqtts://host.com:8883/mqtt"
- edit 回填不再设置 `form.setFieldsValue({ port: server.port })`
- 表单从 6 字段精简为 5 字段

#### 4. AddDeviceModal 与 Settings 页面适配

- AddDeviceModal 服务器选项下拉：display 缩短为仅显示名称，hover 展示完整 brokerUrl
- Settings 页面 `server.brokerUrl:server.port` 改为直接显示 `server.brokerUrl`

#### 5. 旧数据迁移更新

- `migration.ts`：`runMigration()` 将旧 `brokerUrl + ':' + port` 拼接为完整 URL；匹配 broker→serverId 的 key 移除 port
- 兼容 brokerUrl 已含端口号的情况（不再拼接）和协议前缀缺失的情况

#### 6. 测试用例同步更新

- `connectionPool.test.ts`、`router.test.ts`、`rpc.test.ts`：创建 `MqttServer` 时 port 移除，brokerUrl 直接包含端口
- `migration.test.ts`：断言不再检查 `port` 字段，agentUrl 期望值改为含端口完整 URL

---

## 三、Git 提交消息

```
feat(dev): brokerUrl 与 port 字段合并 + connectionFactory TLS 链路修复
```

**正文：**

1. 删除 MqttServer 的 port 字段，brokerUrl 承载完整连接地址（协议+主机+端口+路径）
2. connectionFactory 补传 ca/rejectUnauthorized TLS 选项到 mqtt.connect()
3. testConnection 签名简化，新增 caCert 参数，修复 TLS 测试连接链路
4. MqttServerModal 删除端口号表单项，brokerUrl 校验改为"必含端口"
5. migration 旧数据自动合并 brokerUrl:port，去重 key 移除 port
6. AddDeviceModal 服务器选项 hover 展示完整 brokerUrl

---

## 四、本次提交详情

### 基本信息

| 字段 | 内容 |
|------|------|
| **提交时间** | 2026-06-02 |
| **作者** | NB11000 |
| **提交哈希** | `bc26c67384db29093a50ab970f778b2d238960cf` |
| **基于提交** | `633b4d2` — `fix(dev): Mock 模式 11 项运行时缺陷与 UI 问题集中修复` |
| **变更统计（核心 18 文件）** | 18 files changed, +419 insertions(+), -63 deletions(-) |

### 核心变更文件清单

| 状态 | 文件路径 | 变更说明 |
|------|----------|----------|
| 新建 | `.scratch/merge-brokerurl-port/IMPLEMENTATION-PLAN.md` | 实施计划（+191 行） |
| 新建 | `.scratch/merge-brokerurl-port/PRD.md` | PRD 需求文档（+100 行） |
| 新建 | `.scratch/merge-brokerurl-port/issues/01-data-model-infrastructure.md` | Issue 01（+39 行） |
| 新建 | `.scratch/merge-brokerurl-port/issues/02-modal-ui-migration.md` | Issue 02（+43 行） |
| 修改 | `src/mqtt/types.ts` | 删除 port 字段（-1 行） |
| 修改 | `src/stores/serverStore.ts` | 删除 port + 简化 findDuplicate（+4/-6 行） |
| 修改 | `src/mqtt/connectionFactory.ts` | URL 直接透传 + caCert TLS 链路修复（+5/-2 行） |
| 修改 | `src/mqtt/pool.ts` | testConnection 签名简化 + caCert 支持（+4/-2 行） |
| 修改 | `src/mqtt/connectionPool.ts` | needsReconnect 不再比较 port（-1 行） |
| 修改 | `src/mqtt/migration.ts` | 旧数据 brokerUrl:port 合并 + 去重 key 适配（+14/-6 行） |
| 修改 | `src/components/modals/MqttServerModal.tsx` | 删除 port 表单项 + 校验重写（+8/-32 行） |
| 修改 | `src/components/modals/AddDeviceModal.tsx` | 服务器选项 hover 展示完整 URL（+3/-1 行） |
| 修改 | `src/pages/Settings/index.tsx` | 直接显示完整 brokerUrl（+1/-1 行） |
| 修改 | `CONTEXT.md` | 更新架构文档，移除 port 引用（+3/-4 行） |
| 修改 | `src/mqtt/connectionPool.test.ts` | 测试 server 对象适配（+1/-1 行） |
| 修改 | `src/mqtt/migration.test.ts` | 测试断言移除 port，URL 含端口（+5/-7 行） |
| 修改 | `src/mqtt/router.test.ts` | 测试 server 对象适配（+1/-1 行） |
| 修改 | `src/mqtt/rpc.test.ts` | 测试 server 对象适配（+1/-1 行） |

---

## 五、架构影响

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| MqttServer 字段数 | 9 个（含 port、无 connectionState） | 8 个（port 移除） |
| brokerUrl 语义 | 仅主机+协议，端口独立 | 完整地址含端口+路径 |
| findDuplicate 去重维度 | brokerUrl + port + username | brokerUrl + username |
| connectionFactory 拼接逻辑 | `${brokerUrl}:${port}` | 直接透传 brokerUrl |
| 表单字段数 | 6 个（含 port InputNumber） | 5 个 |
| testConnection 签名 | `(brokerUrl, port, username, password)` | `(brokerUrl, username, password, caCert?)` |
| TLS caCert 链路 | 仅存储，连接时未传入 | 存储 + 建连 + 测试连接完整传递 |

---

## 六、审核报告

> 审查范围：`src/mqtt/types.ts`、`src/stores/serverStore.ts`、`src/mqtt/connectionFactory.ts`、`src/mqtt/pool.ts`、`src/mqtt/connectionPool.ts`、`src/mqtt/migration.ts`、`src/components/modals/`、`src/pages/Settings/`

### 通过项

| # | 检查点 | 详情 |
|---|--------|------|
| 1 | port 字段删除完整性 | `serverStore.ts` 和 `types.ts` 两处均已删除，所有引用点均已更新 |
| 2 | caCert TLS 链路修复 | connectionFactory 补传 ca/rejectUnauthorized；testConnection 接收 caCert 参数 |
| 3 | 表单校验逻辑 | brokerUrl 校验从"禁止含端口"反转为"必须含端口" |
| 4 | 旧数据迁移兼容 | migration 处理 brokerUrl 含/不含端口两种旧数据格式 |
| 5 | 去重逻辑同步 | findDuplicate 和 migration brokerKey 均移除 port 维度 |

### 遗留建议（非阻塞）

| # | 严重度 | 位置 | 建议 |
|---|--------|------|------|
| 1 | 低 | `src/mqtt/types.ts:98` | `MqttServer` 缺少 `caCert` 和 `connectionState` 字段，与 serverStore 版本不一致，建议后续统一 |
