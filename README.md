<div align="center">

# 📊 Finance Agents

### AI-Powered Intelligent A-Share Quantitative Analysis Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=gold)](https://github.com/Noah-Wu66/Finance/stargazers)
[![Forks](https://img.shields.io/github/forks/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=silver)](https://github.com/Noah-Wu66/Finance/network/members)
[![Issues](https://img.shields.io/github/issues/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=orange)](https://github.com/Noah-Wu66/Finance/issues)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Node](https://img.shields.io/badge/Node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br/>

**English** · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

<br/>

> **Early Stage Notice** — This project is under active development. Features, APIs, and UI may change frequently. We are committed to continuous updates and improvements. Star the repo to stay tuned!

<br/>

<img src="https://img.shields.io/badge/Gemini_3.1_Pro-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini" />
<img src="https://img.shields.io/badge/Tushare_Pro-FF6A00?style=flat-square&logoColor=white" alt="Tushare" />
<img src="https://img.shields.io/badge/Next.js_15.5-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/TypeScript_5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />

</div>

---

## What is Finance Agents?

Finance Agents is an **open-source AI-powered quantitative analysis platform** for China's A-Share stock market. Built on **Google Gemini AI** and **Tushare Pro** data sources with a Next.js full-stack architecture, it seamlessly integrates AI analysis capabilities, real-time market data, and intuitive visualizations — making quantitative analysis accessible to everyone.

Whether you need real-time market overviews, AI-driven stock analysis reports, or multi-dimensional stock screening — Finance Agents has you covered.

---

## Key Features

<table>
<tr>
<td width="50%">

### 🤖 AI Deep Analysis
Powered by Google Gemini with web search grounding. Generates comprehensive stock analysis reports with real-time internet data retrieval.

### 📈 Real-Time Market Data
Connected to Tushare Pro for complete Shanghai & Shenzhen market quotes, financials, and fundamental data.

### ⚡ 7-Step Quantitative Workflow
A fully visual analysis pipeline: Code Validation → Basic Info → Market Samples → Financial Metrics → Web Search → AI Quantitative Enhancement → Full Report Generation.

</td>
<td width="50%">

### 🔍 Stock Screening
Multi-dimensional A-share screening by industry sector, price range, PE ratio, and more — quickly locate target stocks.

### ⭐ Watchlist & Favorites
Custom stock watchlist with real-time quotes, pop-up K-line charts (pure SVG, 542 lines), and detailed stock views.

### 📋 Execution Center
Unified management for all analysis tasks — view running, completed, and failed tasks. Push, stop, or delete at any time.

</td>
</tr>
</table>

<table>
<tr>
<td width="33%">

### 🔐 Authentication System
JWT dual-token auth (Access 12h + Refresh 7d) with HttpOnly cookies, bcrypt hashing, and admin role isolation.

</td>
<td width="33%">

### 🌓 Dark / Light Theme
Carefully designed Design Token system with complete light and dark theme support via CSS custom properties.

</td>
<td width="33%">

### 🏗️ Serverless Native
Single-service architecture with no background processes. Frontend-driven task polling, perfectly suited for Vercel serverless.

</td>
</tr>
</table>

---

## 7-Step Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  Quantitative Analysis Flow                  │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  ①   │    ②     │    ③     │    ④     │    ⑤     │    ⑥    │
│Code  │  Basic   │ Market   │Financial │  Web     │ AI Quant │
│Check │  Info    │ Samples  │ Metrics  │ Search   │ Enhance  │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                                       ↓
                                              ⑦ Generate Full Report
```

Each step runs in real-time with live progress visualization. Tasks are driven by frontend polling — close the page and the task automatically stops, preventing resource waste.

---

## Tech Stack

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

| Layer | Technology |
|:------|:-----------|
| Framework | Next.js 15.5 (App Router) |
| Frontend | React 19, Tailwind CSS 4, Framer Motion |
| Language | TypeScript 5.9 (Strict Mode) |
| Database | MongoDB (native driver 6.x) |
| AI Model | Google Gemini (gemini-3.1-pro-preview) with Search Grounding |
| Market Data | Tushare Pro (with concurrency control, rate limiting, exponential backoff) |
| Auth | JWT (jose) + bcryptjs, HttpOnly Cookie, dual-token mechanism |
| Visualization | Pure SVG K-line chart (542 lines, crosshair, prediction data separation) |
| UI Components | Fully hand-crafted (zero external UI library dependencies) |
| Deployment | Vercel Serverless (Function Max Duration: 800s) |

---

## Architecture

```
Finance Agents
│
├── Frontend Layer (React 19 + Tailwind CSS 4)
│   ├── App Shell (Sidebar + Top Nav + Notification Bell)
│   └── Business Pages (Dashboard / Analysis / Screening / Executions / Favorites)
│
├── API Layer (Next.js Route Handlers — 24 modules, 100+ routes)
│   ├── Auth APIs (Login / Logout / Register / Token Refresh / Password Reset)
│   ├── Business APIs (Analysis / Market Data / Favorites / Screening / Reports)
│   └── Admin APIs (Database / Cache / Logs — Admin only)
│
├── Core Engine (lib/)
│   ├── execution-engine.ts  — 7-step analysis state machine (2000+ lines)
│   ├── ai-client.ts         — Gemini AI calls (web search grounding + streaming)
│   ├── tushare-data.ts      — Tushare API (concurrency 3, interval 250ms, 6 retries)
│   └── auth.ts              — JWT dual-token authentication
│
└── Middleware Layer (middleware.ts)
    ├── JWT Authentication & Route Protection
    ├── Admin Permission Isolation
    └── API Rate Limiting (240 req/min, tick 20 req/30s)
```

---

## Deployment

Finance Agents is designed for **Vercel Pro** deployment. No local runtime is provided.

### Prerequisites

- Vercel Pro account
- MongoDB database (e.g., [MongoDB Atlas](https://www.mongodb.com/atlas) — free tier available)
- [Google Gemini API Key](https://aistudio.google.com/)
- [Tushare Pro Token](https://tushare.pro/register)

### Environment Variables

| Variable | Required | Purpose |
|:---------|:--------:|:--------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `MONGODB_DB` | ✅ | Database name |
| `JWT_SECRET` | ✅ | Auth token signing secret (use a long random string) |
| `GOOGLE_API_KEY` | ✅ | Google Gemini AI access |
| `TUSHARE_TOKEN` | ✅ | Tushare Pro market data access |

> **Note:** No `.env.example` file is provided. This README is the single source of truth for environment configuration.

### Deploy Steps

1. **Fork** this repository
2. Import to [Vercel](https://vercel.com/) → `Add New Project` → select the forked repo
3. Configure **Environment Variables** in Vercel project settings
4. Set **Function Max Duration** to `800` seconds in Vercel → Settings → Functions
5. Click **Deploy** and wait for the build to complete

---

## Project Structure

```
finance-agents/
├── app/
│   ├── (workspace)/              # Authenticated workspace (shared AppShell layout)
│   │   ├── dashboard/            # Market overview
│   │   ├── analysis/             # Quantitative analysis
│   │   ├── screening/            # Stock screening
│   │   ├── executions/           # Execution center
│   │   ├── favorites/            # Watchlist
│   │   ├── reports/[id]/         # Report detail (dynamic route)
│   │   ├── stocks/[code]/        # Stock detail (dynamic route)
│   │   └── settings/             # User settings + Admin panel
│   ├── api/                      # 24 API modules, 100+ route files
│   │   ├── auth/                 # Authentication (11 endpoints)
│   │   ├── analysis/             # Stock analysis
│   │   ├── executions/           # Task management
│   │   ├── reports/              # Analysis reports
│   │   ├── favorites/            # Watchlist management
│   │   ├── screening/            # Stock screening
│   │   ├── dashboard/            # Market indices
│   │   ├── stocks/               # Stock data (quote/kline/fundamentals/news)
│   │   ├── markets/              # Market search
│   │   ├── tushare/              # Tushare direct query
│   │   ├── cache/                # Cache management (admin)
│   │   ├── system/               # System management (admin)
│   │   └── ...                   # More modules
│   ├── login/                    # Login page
│   └── register/                 # Register page
│
├── components/
│   ├── app-shell.tsx             # Page framework (sidebar + nav + notifications)
│   ├── stock-detail-modal.tsx    # Stock detail modal
│   └── ui/                       # Hand-crafted UI components (13 components)
│       ├── button.tsx            # Button (5 variants)
│       ├── kline-chart.tsx       # K-line chart (pure SVG, 542 lines)
│       ├── theme-toggle.tsx      # Dark/Light theme toggle
│       └── ...                   # More components
│
├── lib/                          # Core business logic (22 modules)
│   ├── execution-engine.ts       # 7-step analysis state machine
│   ├── ai-client.ts              # Gemini AI integration
│   ├── tushare-data.ts           # Tushare API with rate limiting
│   ├── auth.ts                   # JWT dual-token auth
│   └── ...                       # More modules
│
├── middleware.ts                  # Global middleware (auth + rate limiting)
└── vercel.json                    # Vercel deployment config
```

---

## Roadmap

- [x] JWT dual-token authentication system
- [x] 7-step visual quantitative analysis workflow
- [x] Dark / Light theme switching
- [x] Admin panel (Database / Cache / Logs / System Logs / Scheduler)
- [x] Notification center
- [x] K-line chart visualization (pure SVG)
- [x] API rate limiting protection
- [x] Stock screening by industry, price, PE
- [x] Execution center with task management
- [ ] Hong Kong & US stock market support
- [ ] Report export (PDF / Markdown)
- [ ] More screening dimensions (ROE, net profit growth, dividend yield)
- [ ] Watchlist grouping & tag management
- [ ] Batch analysis task queue
- [ ] Custom analysis templates
- [ ] Mobile experience optimization
- [ ] Voice input & AI interaction

---

## Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests — every bit helps.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Disclaimer

- This project is for **learning and technical research purposes only** and does **not constitute investment advice**
- Stock data is provided by Tushare Pro; AI analysis results are generated by Google Gemini — for reference only
- Please ensure compliance with the terms of service of Tushare, Google, and other data providers before use

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

## Star History

<a href="https://star-history.com/#Noah-Wu66/Finance&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
 </picture>
</a>

<br/>
<br/>

**If you find Finance Agents useful, please consider giving it a Star!**

<br/>

[![Star this repo](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=social)](https://github.com/Noah-Wu66/Finance)

<br/>

---

<sub>Built with passion. Powered by open source.</sub>

</div>
