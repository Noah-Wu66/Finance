# TradingAgents WebApp (Next.js App Router)

基于 **Next.js App Router** 的全栈单服务项目，部署平台为 **Vercel（Node.js 24.x）**。

## 架构

- 单服务：前端页面与后端 API 全部在同一项目内
- 技术栈：Next.js + React + TypeScript + MongoDB
- 运行模式：**页面现场执行**
  - 用户在网页发起任务后，任务由页面轮询推进
  - 页面关闭或离开后，运行中任务自动停止

## 目录说明

- `app/`：页面路由与 API 路由
- `lib/`：认证、执行引擎、数据库与业务服务
- `components/`：通用界面组件
- `vercel.json`：Vercel 函数运行时配置（Node.js 24.x）

## 部署要求

- Node.js：`24.x`
- Vercel Project 环境变量至少配置：`MONGODB_URI`、`MONGODB_DB`、`JWT_SECRET`
