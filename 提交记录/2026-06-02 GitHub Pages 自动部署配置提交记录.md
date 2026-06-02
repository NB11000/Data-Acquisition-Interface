# 提交记录

> 生成时间：2026-06-02 17:00
> 仓库：Data-Acquisition-Interface
> 分支：`dev`

---

## 一、背景（Background）

项目当前缺少自动化部署链路，构建与发布依赖手动操作，无法提供稳定的线上预览地址。同时 Vite 默认 `base: '/'` 会导致 GitHub Pages 子路径下静态资源 404。

### 问题（Problem）

#### 1. 无自动化部署能力

每次更新需手动执行 `pnpm build` 并自行部署 `dist/` 到服务器，流程繁琐且容易遗漏。

#### 2. Vite 未适配 GitHub Pages 子路径

GitHub Pages 部署在 `https://nb11000.github.io/Data-Acquisition-Interface/` 时，`/assets/index.js` 等路径会直接 404，需要 `base` 前缀 `'/Data-Acquisition-Interface/'`。

#### 3. 生产构建环境变量缺失

`.env` 文件被 `.gitignore` 排除，CI 构建时需要额外的环境变量注入机制。

---

## 二、解决方案（Solution）

### 整体思路

通过 GitHub Actions 工作流监听 `dev` 分支推送事件，自动执行类型检查与 Vite 构建，产物通过 `actions/deploy-pages@v4` 部署到 GitHub Pages，实现 push-to-deploy。

### 具体实施

#### 1. Vite 配置 `base` 路径

```ts
// vite.config.ts
export default defineConfig({
  base: '/Data-Acquisition-Interface/', // 新增：GitHub Pages 子路径适配
  // ...
});
```

#### 2. GitHub Actions 部署工作流

新建 `.github/workflows/deploy.yml`，包含两个 job：
- **build**：checkout → pnpm install → 写入环境变量 → tsc + vite build → upload artifact
- **deploy**：等待 build 完成 → `actions/deploy-pages@v4` 部署到 GitHub Pages

环境变量支持通过 GitHub Secrets 注入（`VITE_MQTT_MODE`），无 secret 时回退到 `.env.production` 默认值 `real`。

#### 3. 生产环境变量文件

新建 `.env.production`，Vite 在 `vite build` 时自动读取（优先级低于 `.env.production.local`）：

```
VITE_MQTT_MODE=real
```

---

## 三、Git 提交消息

```
feat(dev): 新增 GitHub Pages 自动部署配置

1. vite.config.ts 添加 base 路径适配 GitHub Pages 子路径
2. 新增 GitHub Actions 工作流，监听 dev 分支自动构建部署
3. 新增 .env.production 生产环境变量文件

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## 四、本次提交详情

### 基本信息

| 字段 | 内容 |
|------|------|
| **提交时间** | 2026-06-02 17:00:00 |
| **作者** | NB11000 |
| **提交哈希** | `<待提交后填充>` |
| **基于提交** | `4afef18` — `feat(dev): brokerUrl 与 port 字段合并 + connectionFactory TLS 链路修复` (2026-06-02 16:53) |
| **变更统计（核心 3 文件）** | 3 files changed, +61 insertions(+), 0 deletions(-) |

### 核心变更文件清单

| 状态 | 文件路径 | 变更说明 |
|------|----------|----------|
| 修改 | `vite.config.ts` | 添加 `base: '/Data-Acquisition-Interface/'`（+1 行） |
| 新建 | `.github/workflows/deploy.yml` | GitHub Actions 自动部署工作流，build + deploy 双 Job（+59 行） |
| 新建 | `.env.production` | 生产环境变量，VITE_MQTT_MODE=real（+1 行） |

---

## 五、架构影响

变更前：无 CI/CD，纯手动构建部署。变更后：推送 `dev` 分支自动触发 GitHub Pages 部署，访问 `https://nb11000.github.io/Data-Acquisition-Interface/` 即可查看最新构建。

无代码架构变更，仅构建与部署层面增加自动化流水线。

---

## 六、审核报告

> 审查范围：`vite.config.ts`、`.github/workflows/deploy.yml`、`.env.production`

### 通过项

| # | 检查点 | 详情 |
|---|--------|------|
| 1 | Vite base 路径正确 | `/Data-Acquisition-Interface/` 与仓库名一致 |
| 2 | CI 工作流完整 | 包含 checkout / pnpm install / build / deploy 完整链路 |
| 3 | 敏感信息隔离 | `.env` 已在 `.gitignore`，CI 环境变量通过 Secrets 注入 |
| 4 | 缓存利用 | `pnpm/action-setup` + `setup-node(cache: pnpm)` 加速安装 |

### 已修复问题

无。

### 遗留建议（非阻塞）

| # | 严重度 | 位置 | 建议 |
|---|--------|------|------|
| 1 | 低 | `.github/workflows/deploy.yml` | 如果后续新增 `VITE_BROKER_URL` 等环境变量，需同步更新 workflow 中的 `echo` 写入步骤 |

---

## 七、后续步骤预览（不在本次范围）

- 步骤 1：推送代码后，在 GitHub 仓库 `Settings → Pages → Source` 选择 **GitHub Actions**
- 步骤 2：如 MQTT 连接需要 `BROKER_URL`/`USERNAME`/`PASSWORD`，在 `Settings → Secrets → Actions` 中添加对应 Secret
- 步骤 3：部署成功后，访问 `https://nb11000.github.io/Data-Acquisition-Interface/` 验证页面功能
