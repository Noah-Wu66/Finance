<div align="center">

# 📊 Finance Agents

**AI 驱动的智能 A 股量化分析平台**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Vercel](https://img.shields.io/badge/Vercel-部署-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

[![Status](https://img.shields.io/badge/状态-早期版本，持续更新中-orange?style=flat-square)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-欢迎贡献-brightgreen?style=flat-square)](https://github.com/)

[功能介绍](#-功能模块) · [技术栈](#-技术栈) · [快速部署](#-快速部署) · [项目架构](#-项目架构) · [路线图](#-路线图)

</div>

---

> **🚧 早期版本声明**
>
> 本项目目前处于**早期开发阶段**，功能仍在持续完善中，API 接口和数据结构可能随版本迭代发生变更。  
> 欢迎 ⭐ Star 关注，我们会持续更新！

---

## 项目简介

Finance Agents 是一个基于 **Google Gemini AI** 和 **Tushare Pro 数据源**构建的 A 股智能分析平台。通过 Next.js 全栈架构，将 AI 分析能力、实时行情数据与直观的可视化界面融为一体，让量化分析变得触手可及。

### ✨ 核心亮点

|  |  |
|--|--|
| 🤖 **AI 深度分析** | 接入 Google Gemini，支持联网检索最新资讯，生成全面的股票分析报告 |
| 📡 **实时行情数据** | 对接 Tushare Pro，获取沪深两市完整行情与财务数据 |
| ⚡ **7 步量化流程** | 从数据采集到 AI 分析，全流程可视化，实时查看每一步执行进度 |
| 🔒 **完整认证体系** | JWT 双 Token 机制，HttpOnly Cookie 存储，内置 API 限流防护 |
| 🌓 **深浅主题切换** | 精心设计的 Design Token 体系，支持明暗两套完整主题 |
| 🏗️ **Serverless 友好** | 单服务架构，无需常驻后台进程，完美适配 Vercel 无服务器环境 |

---

## 🧩 功能模块

### 📈 大盘总览

实时展示**沪深 300、上证指数、深证成指、创业板指**四大核心指数行情，配合自选股涨跌一览，快速掌握市场整体动态。

---

### 🤖 量化分析

输入股票代码，一键发起 AI 驱动的全方位量化分析。分析任务分为 **7 个可视化步骤**实时推进，全程透明可控：

```
┌─────────────────────────────────────────────────────────────┐
│                      量化分析流程                            │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  ①   │    ②     │    ③     │    ④     │    ⑤     │    ⑥    │
│校验  │  基础    │  行情    │  财务    │  联网    │  AI 量化 │
│代码  │  信息    │  样本    │  指标    │  检索    │  增强    │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                                      ↓
                                             ⑦ 生成完整分析报告
```

---

### 🔍 股票筛选

支持按**行业板块**、**价格区间**、**PE 上限**等多维度条件筛选 A 股标的，快速定位目标股票。

---

### 📋 执行中心

统一管理所有历史分析任务，支持查看**运行中 / 已完成 / 失败**三种状态，可随时推进、停止或删除任务记录。

---

### ⭐ 自选股

自定义关注股票池，实时查看行情数据，支持弹窗快速查看 **K 线图**和个股详情。

---

### ⚙️ 偏好设置

个人配置中心，支持设置默认市场、自动刷新间隔等偏好。管理员另有专属入口，可访问数据库管理、缓存管理、操作日志、系统日志、定时任务等后台功能。

---

## 🛠 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | [Next.js](https://nextjs.org/) App Router | 15.5.9 |
| 前端 | [React](https://react.dev/) | 19.2.4 |
| 类型系统 | [TypeScript](https://www.typescriptlang.org/) | 5.9.3 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) | 4.x |
| 数据库 | [MongoDB](https://www.mongodb.com/) | 6.x |
| AI 模型 | [Google Gemini](https://ai.google.dev/) | gemini-3.1-pro-preview |
| 行情数据 | [Tushare Pro](https://tushare.pro/) | — |
| 认证 | [jose](https://github.com/panva/jose) (JWT) + bcryptjs | — |
| 运行时 | Node.js | 24.x |
| 部署 | [Vercel](https://vercel.com/) | — |

---

## 🏗 项目架构

```
Finance Agents
│
├── 前端层 (React + Tailwind CSS)
│   ├── App Shell（侧边栏 + 顶部导航 + 通知铃铛）
│   └── 业务页面（总览 / 分析 / 筛选 / 执行中心 / 自选股）
│
├── API 层 (Next.js Route Handlers)
│   ├── 认证接口（登录 / 登出 / 注册 / Token 刷新）
│   ├── 业务接口（分析任务 / 行情数据 / 自选股 / 筛选）
│   └── 管理接口（数据库 / 缓存 / 日志，仅管理员）
│
├── 核心引擎 (lib/)
│   ├── execution-engine.ts  — 7 步分析状态机（核心）
│   ├── ai-client.ts         — Gemini AI 调用（含联网检索）
│   ├── tushare-data.ts      — Tushare 行情数据（含限流/重试）
│   └── auth.ts              — JWT 双 Token 认证
│
└── 中间件层 (middleware.ts)
    ├── JWT 鉴权与路由保护
    ├── 管理员权限隔离
    └── API 限流（普通接口 240 次/分钟）
```

### 架构特点

- **单服务架构**：前端页面与后端 API 同在一个 Next.js 项目，无需维护独立后端服务
- **页面现场执行**：分析任务由前端页面轮询驱动推进，关闭页面时任务自动停止，天然避免资源浪费
- **无后台常驻服务**：不依赖 Worker、WebSocket 或定时调度器，完美适配 Serverless 环境

---

## 📁 目录结构

```
├── app/
│   ├── (workspace)/          # 登录后工作区（共享 AppShell 布局）
│   │   ├── dashboard/        # 大盘总览
│   │   ├── analysis/         # 量化分析
│   │   ├── screening/        # 股票筛选
│   │   ├── executions/       # 执行中心
│   │   ├── favorites/        # 自选股
│   │   ├── reports/[id]/     # 分析报告详情（动态路由）
│   │   ├── stocks/[code]/    # 股票详情（动态路由）
│   │   └── settings/         # 偏好设置（含管理员子页面）
│   ├── api/                  # 后端 API 路由（24 个功能模块）
│   ├── login/                # 登录页
│   └── register/             # 注册页
│
├── components/
│   ├── app-shell.tsx         # 整体页面框架（侧边栏 + 顶部导航）
│   ├── stock-detail-modal.tsx# 股票详情弹窗
│   └── ui/                   # 基础 UI 组件库
│       ├── button.tsx        # 按钮（5 种变体）
│       ├── kline-chart.tsx   # K 线图（Canvas 渲染）
│       ├── status-badge.tsx  # 状态标签
│       └── ...               # 更多组件
│
├── lib/                      # 后端核心业务逻辑（22 个模块）
│   ├── execution-engine.ts   # 分析任务执行引擎
│   ├── ai-client.ts          # Gemini AI 调用封装
│   ├── tushare-data.ts       # Tushare API 封装
│   └── auth.ts               # 用户认证
│
└── middleware.ts              # 全局中间件（鉴权 + 限流）
```

---

## 🚀 快速部署

### 前置条件

在部署前，你需要准备以下账号和资源：

| 资源 | 用途 | 获取地址 |
|------|------|----------|
| MongoDB 数据库 | 存储用户数据和分析结果 | [MongoDB Atlas](https://www.mongodb.com/atlas)（有免费套餐）|
| Google Gemini API Key | 驱动 AI 分析能力 | [Google AI Studio](https://aistudio.google.com/) |
| Tushare Pro Token | 获取 A 股行情数据 | [Tushare Pro](https://tushare.pro/register) |

### 部署步骤

**1. Fork 本仓库**

点击右上角 Fork，将项目复制到你的 GitHub 账号下。

**2. 导入到 Vercel**

前往 [Vercel](https://vercel.com/)，点击 `Add New Project`，选择刚才 Fork 的仓库导入。

**3. 配置环境变量**

在 Vercel 项目设置的 `Environment Variables` 中，添加以下变量：

```env
# 数据库连接
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=your_database_name

# JWT 认证密钥（建议使用随机长字符串）
JWT_SECRET=your_random_jwt_secret_key

# Google Gemini AI
GOOGLE_API_KEY=your_google_api_key

# Tushare 行情数据
TUSHARE_TOKEN=your_tushare_token
```

**4. 调整超时配置（重要）**

进入 Vercel 项目设置 → `Functions` → 将 `Function Max Duration` 设置为 `800` 秒，确保 AI 分析任务有足够执行时间。

**5. 部署**

点击 `Deploy`，等待构建完成即可访问！

---

## 🗺 路线图

> 本项目处于早期版本，以下功能正在规划或开发中，持续迭代更新。

**已完成 ✅**

- [x] 双 Token JWT 认证体系
- [x] 7 步可视化量化分析流程
- [x] 深浅主题切换
- [x] 管理员后台（数据库 / 缓存 / 日志）
- [x] 系统通知中心
- [x] K 线图可视化
- [x] API 限流防护

**规划中 📌**

- [ ] 港股、美股市场支持
- [ ] 分析报告导出（PDF / Markdown）
- [ ] 更多筛选维度（ROE、净利润增速、股息率等）
- [ ] 自选股分组与标签管理
- [ ] 批量分析任务队列
- [ ] 分析模板自定义
- [ ] 移动端体验优化

---

## 🤝 贡献

欢迎通过以下方式参与贡献：

- 提交 [Issue](../../issues) 反馈 Bug 或建议新功能
- 提交 [Pull Request](../../pulls) 贡献代码改进

---

## ⚠️ 免责声明

- 本项目仅供学习和技术研究使用，**不构成任何投资建议**
- 股票数据由 Tushare Pro 提供，AI 分析结果由 Google Gemini 生成，仅供参考
- 使用前请确保遵守 Tushare、Google 等相关数据服务商的使用条款

---

<div align="center">

**如果这个项目对你有帮助，欢迎点个 ⭐ Star 支持！**

本项目持续更新中，欢迎 👁 Watch 关注最新进展

</div>
