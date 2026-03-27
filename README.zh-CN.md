<div align="center">

# 📊 Finance Agents

### AI 驱动的智能 A 股量化分析平台

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=gold)](https://github.com/Noah-Wu66/Finance/stargazers)
[![Forks](https://img.shields.io/github/forks/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=silver)](https://github.com/Noah-Wu66/Finance/network/members)
[![Issues](https://img.shields.io/github/issues/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=orange)](https://github.com/Noah-Wu66/Finance/issues)
[![Deploy with Vercel](https://img.shields.io/badge/部署-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Node](https://img.shields.io/badge/Node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br/>

[English](./README.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md)

<br/>

> **早期版本声明** — 本项目目前处于积极开发阶段，功能、API 和界面可能会频繁变更。我们致力于持续更新和改进。请 Star 关注最新动态！

<br/>

<img src="https://img.shields.io/badge/Gemini_3.1_Pro-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini" />
<img src="https://img.shields.io/badge/Tushare_Pro-FF6A00?style=flat-square&logoColor=white" alt="Tushare" />
<img src="https://img.shields.io/badge/Next.js_15.5-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/TypeScript_5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />

</div>

---

## 项目简介

Finance Agents 是一个基于 **Google Gemini AI** 和 **Tushare Pro 数据源**构建的**开源 A 股智能量化分析平台**。通过 Next.js 全栈架构，将 AI 分析能力、实时行情数据与直观的可视化界面融为一体，让量化分析变得触手可及。

无论你需要实时大盘总览、AI 驱动的个股深度分析，还是多维度股票筛选 — Finance Agents 都能满足你的需求。

---

## 核心功能

<table>
<tr>
<td width="50%">

### 🤖 AI 深度分析
接入 Google Gemini，支持联网检索最新资讯（Search Grounding），生成全面的股票分析报告，让 AI 助你洞察市场。

### 📈 实时行情数据
对接 Tushare Pro，获取沪深两市完整行情数据、财务指标与基本面信息，数据准确及时。

### ⚡ 7 步量化流程
从数据采集到 AI 分析，全流程可视化：代码校验 → 基础信息 → 行情样本 → 财务指标 → 联网检索 → AI 量化增强 → 生成完整报告。

</td>
<td width="50%">

### 🔍 股票筛选
支持按行业板块、价格区间、PE 上限等多维度条件筛选 A 股标的，快速定位目标股票。

### ⭐ 自选股管理
自定义关注股票池，实时查看行情数据，支持弹窗快速查看 K 线图（纯 SVG 手写，542 行代码）和个股详情。

### 📋 执行中心
统一管理所有历史分析任务，支持查看运行中/已完成/失败三种状态，可随时推进、停止或删除任务。

</td>
</tr>
</table>

<table>
<tr>
<td width="33%">

### 🔐 完整认证体系
JWT 双 Token 机制（Access 12h + Refresh 7d），HttpOnly Cookie 存储，bcrypt 加密，管理员角色隔离。

</td>
<td width="33%">

### 🌓 深浅主题切换
精心设计的 Design Token 体系，通过 CSS 自定义属性实现完整的明暗两套主题，界面舒适美观。

</td>
<td width="33%">

### 🏗️ Serverless 原生
单服务架构，无需常驻后台进程。前端轮询驱动任务推进，关闭页面自动停止，完美适配 Vercel 无服务器环境。

</td>
</tr>
</table>

---

## 7 步量化分析流程

```
┌─────────────────────────────────────────────────────────────┐
│                      量化分析流程                            │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  ①   │    ②     │    ③     │    ④     │    ⑤     │    ⑥    │
│代码  │  基础    │  行情    │  财务    │  联网    │  AI 量化 │
│校验  │  信息    │  样本    │  指标    │  检索    │  增强    │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                                       ↓
                                              ⑦ 生成完整分析报告
```

每一步都实时可视化，任务由前端轮询驱动推进 — 关闭页面时任务自动停止，天然避免资源浪费。

---

## 技术栈

<table>
<tr>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=nextjs" width="48" height="48" alt="Next.js" /><br><sub>Next.js 15.5</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=react" width="48" height="48" alt="React" /><br><sub>React 19</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=ts" width="48" height="48" alt="TypeScript" /><br><sub>TypeScript 5.9</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=tailwind" width="48" height="48" alt="Tailwind" /><br><sub>Tailwind CSS 4</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=mongodb" width="48" height="48" alt="MongoDB" /><br><sub>MongoDB</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=vercel" width="48" height="48" alt="Vercel" /><br><sub>Vercel</sub><br></td>
<td align="center" width="96"><br><img src="https://skillicons.dev/icons?i=nodejs" width="48" height="48" alt="Node.js" /><br><sub>Node 24</sub><br></td>
</tr>
</table>

| 分类 | 技术 |
|:------|:-----------|
| 框架 | Next.js 15.5 (App Router) |
| 前端 | React 19, Tailwind CSS 4, Framer Motion |
| 类型系统 | TypeScript 5.9 (严格模式) |
| 数据库 | MongoDB (原生驱动 6.x) |
| AI 模型 | Google Gemini (gemini-3.1-pro-preview)，支持联网检索 |
| 行情数据 | Tushare Pro（并发控制、限流、指数退避重试） |
| 认证 | JWT (jose) + bcryptjs，HttpOnly Cookie，双 Token 机制 |
| 可视化 | 纯 SVG K 线图（542 行，十字光标，预测数据虚线区分） |
| UI 组件 | 全手写（零外部 UI 库依赖） |
| 部署 | Vercel Serverless（Function Max Duration: 800s） |

---

## 项目架构

```
Finance Agents
│
├── 前端层 (React 19 + Tailwind CSS 4)
│   ├── App Shell（侧边栏 + 顶部导航 + 通知铃铛）
│   └── 业务页面（总览 / 分析 / 筛选 / 执行中心 / 自选股）
│
├── API 层 (Next.js Route Handlers — 24 个模块，100+ 路由文件)
│   ├── 认证接口（登录 / 登出 / 注册 / Token 刷新 / 密码重置）
│   ├── 业务接口（分析任务 / 行情数据 / 自选股 / 筛选 / 报告）
│   └── 管理接口（数据库 / 缓存 / 日志 — 仅管理员）
│
├── 核心引擎 (lib/)
│   ├── execution-engine.ts  — 7 步分析状态机（2000+ 行）
│   ├── ai-client.ts         — Gemini AI 调用（联网检索 + 流式输出）
│   ├── tushare-data.ts      — Tushare API（并发 3，间隔 250ms，6 次重试）
│   └── auth.ts              — JWT 双 Token 认证
│
└── 中间件层 (middleware.ts)
    ├── JWT 鉴权与路由保护
    ├── 管理员权限隔离
    └── API 限流（普通接口 240 次/分钟，tick 20 次/30 秒）
```

---

## 快速部署

Finance Agents 专为 **Vercel Pro** 部署设计，无需本地运行环境。

### 前置条件

- Vercel Pro 账号
- MongoDB 数据库（推荐 [MongoDB Atlas](https://www.mongodb.com/atlas)，有免费套餐）
- [Google Gemini API Key](https://aistudio.google.com/)
- [Tushare Pro Token](https://tushare.pro/register)

### 环境变量

| 变量名 | 必填 | 用途 |
|:---------|:--------:|:--------|
| `MONGO_URI` | ✅ | MongoDB 连接字符串 |
| `MONGODB_DB` | ✅ | 数据库名称 |
| `JWT_SECRET` | ✅ | JWT 认证密钥（建议使用随机长字符串） |
| `GOOGLE_API_KEY` | ✅ | Google Gemini AI 访问密钥 |
| `TUSHARE_TOKEN` | ✅ | Tushare Pro 行情数据 Token |

> **注意：** 本项目不提供 `.env.example` 文件，此 README 即为环境配置的唯一参考。

### 部署步骤

1. **Fork** 本仓库到你的 GitHub 账号
2. 前往 [Vercel](https://vercel.com/) → `Add New Project` → 选择刚 Fork 的仓库导入
3. 在 Vercel 项目设置中配置**环境变量**
4. 进入 Vercel → Settings → Functions → 将 **Function Max Duration** 设置为 `800` 秒
5. 点击 **Deploy**，等待构建完成即可访问

---

## 目录结构

```
finance-agents/
├── app/
│   ├── (workspace)/              # 登录后工作区（共享 AppShell 布局）
│   │   ├── dashboard/            # 大盘总览
│   │   ├── analysis/             # 量化分析
│   │   ├── screening/            # 股票筛选
│   │   ├── executions/           # 执行中心
│   │   ├── favorites/            # 自选股
│   │   ├── reports/[id]/         # 分析报告详情（动态路由）
│   │   ├── stocks/[code]/        # 股票详情（动态路由）
│   │   └── settings/             # 偏好设置（含管理员子页面）
│   ├── api/                      # 24 个 API 功能模块，100+ 路由文件
│   │   ├── auth/                 # 认证（11 个端点）
│   │   ├── analysis/             # 分析任务
│   │   ├── executions/           # 任务管理
│   │   ├── reports/              # 分析报告
│   │   ├── favorites/            # 自选股管理
│   │   ├── screening/            # 股票筛选
│   │   ├── dashboard/            # 大盘指数
│   │   ├── stocks/               # 股票数据（行情/K线/基本面/新闻）
│   │   ├── markets/              # 市场搜索
│   │   ├── tushare/              # Tushare 直查
│   │   ├── cache/                # 缓存管理（管理员）
│   │   ├── system/               # 系统管理（管理员）
│   │   └── ...                   # 更多模块
│   ├── login/                    # 登录页
│   └── register/                 # 注册页
│
├── components/
│   ├── app-shell.tsx             # 页面框架（侧边栏 + 导航 + 通知）
│   ├── stock-detail-modal.tsx    # 股票详情弹窗
│   └── ui/                       # 手写 UI 组件库（13 个组件）
│       ├── button.tsx            # 按钮（5 种变体）
│       ├── kline-chart.tsx       # K 线图（纯 SVG，542 行）
│       ├── theme-toggle.tsx      # 深浅主题切换
│       └── ...                   # 更多组件
│
├── lib/                          # 核心业务逻辑（22 个模块）
│   ├── execution-engine.ts       # 7 步分析状态机
│   ├── ai-client.ts              # Gemini AI 集成
│   ├── tushare-data.ts           # Tushare API 封装
│   ├── auth.ts                   # JWT 双 Token 认证
│   └── ...                       # 更多模块
│
├── middleware.ts                  # 全局中间件（鉴权 + 限流）
└── vercel.json                    # Vercel 部署配置
```

---

## 路线图

**已完成**

- [x] JWT 双 Token 认证体系
- [x] 7 步可视化量化分析流程
- [x] 深浅主题切换
- [x] 管理员后台（数据库 / 缓存 / 日志 / 系统日志 / 定时任务）
- [x] 系统通知中心
- [x] K 线图可视化（纯 SVG 手写）
- [x] API 限流防护
- [x] 多维度股票筛选
- [x] 执行中心任务管理

**规划中**

- [ ] 港股、美股市场支持
- [ ] 分析报告导出（PDF / Markdown）
- [ ] 更多筛选维度（ROE、净利润增速、股息率等）
- [ ] 自选股分组与标签管理
- [ ] 批量分析任务队列
- [ ] 分析模板自定义
- [ ] 移动端体验优化
- [ ] 语音输入与 AI 交互

---

## 贡献

欢迎通过以下方式参与贡献！无论是 Bug 报告、功能建议还是代码提交，每一份贡献都很有价值。

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 免责声明

- 本项目仅供**学习和技术研究使用**，**不构成任何投资建议**
- 股票数据由 Tushare Pro 提供，AI 分析结果由 Google Gemini 生成，仅供参考
- 使用前请确保遵守 Tushare、Google 等相关数据服务商的使用条款

---

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

<div align="center">

## Star 趋势

<a href="https://star-history.com/#Noah-Wu66/Finance&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
 </picture>
</a>

<br/>
<br/>

**如果这个项目对你有帮助，欢迎点个 Star 支持！**

<br/>

[![Star this repo](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=social)](https://github.com/Noah-Wu66/Finance)

<br/>

---

<sub>用热爱构建，以开源驱动。</sub>

</div>
