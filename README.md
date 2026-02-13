# Finance Agents

AI 驱动的智能股票分析平台，基于 Next.js App Router 构建的全栈单服务应用。

## 功能模块

| 模块 | 说明 |
|------|------|
| 总览 | 大盘指数实时行情、自选股涨跌一览 |
| 量化分析 | AI 股票分析任务，实时查看执行过程与日志 |
| 股票筛选 | 按条件筛选股票 |
| 执行中心 | 查看所有分析任务的状态与历史 |
| 自选股 | 管理自选股列表，支持标签分类 |
| 偏好设置 | 用户偏好配置、用量统计、系统管理 |

## 技术栈

- **框架**: Next.js 15.5.9 (App Router)
- **前端**: React 19 + TypeScript + Tailwind CSS 4.x
- **数据库**: MongoDB
- **部署**: Vercel (Node.js 24.x)

## 架构特点

- **单服务架构**: 前端页面与后端 API 同在一个项目
- **页面现场执行**: 分析任务由页面轮询推进，关闭页面后运行中任务自动停止
- **无后台常驻服务**: 不依赖 Worker、定时调度器和 WebSocket

## 目录结构

```
app/
├── (workspace)/     # 登录后的工作区页面
│   ├── dashboard/   # 总览
│   ├── analysis/    # 量化分析
│   ├── screening/   # 股票筛选
│   ├── executions/  # 执行中心
│   ├── favorites/   # 自选股
│   ├── reports/     # 分析报告
│   ├── stocks/      # 股票详情
│   └── settings/    # 偏好设置
├── api/             # API 路由
├── login/           # 登录页
└── register/        # 注册页

lib/                 # 核心业务逻辑
components/          # UI 组件
```

## 部署要求

- Node.js: `24.x`
- 环境变量:
  - `MONGODB_URI` - MongoDB 连接字符串
  - `MONGODB_DB` - 数据库名称
  - `JWT_SECRET` - JWT 签名密钥
