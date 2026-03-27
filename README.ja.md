<div align="center">

# 📊 Finance Agents

### AI搭載 中国A株インテリジェント定量分析プラットフォーム

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=gold)](https://github.com/Noah-Wu66/Finance/stargazers)
[![Forks](https://img.shields.io/github/forks/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=silver)](https://github.com/Noah-Wu66/Finance/network/members)
[![Issues](https://img.shields.io/github/issues/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=orange)](https://github.com/Noah-Wu66/Finance/issues)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Node](https://img.shields.io/badge/Node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br/>

[English](./README.md) · [简体中文](./README.zh-CN.md) · **日本語** · [한국어](./README.ko.md)

<br/>

> **アーリーステージ通知** — 本プロジェクトは積極的に開発中です。機能、API、UIは頻繁に変更される可能性があります。継続的な更新と改善に取り組んでいます。最新情報を受け取るにはStarをお願いします！

<br/>

<img src="https://img.shields.io/badge/Gemini_3.1_Pro-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini" />
<img src="https://img.shields.io/badge/Tushare_Pro-FF6A00?style=flat-square&logoColor=white" alt="Tushare" />
<img src="https://img.shields.io/badge/Next.js_15.5-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/TypeScript_5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />

</div>

---

## Finance Agents とは？

Finance Agents は、**Google Gemini AI** と **Tushare Pro データソース**を基盤とした**オープンソースのA株インテリジェント定量分析プラットフォーム**です。Next.js フルスタックアーキテクチャにより、AI分析機能、リアルタイム市場データ、直感的なビジュアライゼーションをシームレスに統合し、定量分析を誰にでもアクセス可能にします。

リアルタイムの市場概況、AI駆動の銘柄分析レポート、多次元の株式スクリーニングなど — Finance Agents がすべてをカバーします。

---

## 主な機能

<table>
<tr>
<td width="50%">

### 🤖 AIディープ分析
Google Gemini搭載、ウェブ検索グラウンディング対応。リアルタイムのインターネットデータを活用した包括的な株式分析レポートを生成します。

### 📈 リアルタイム市場データ
Tushare Proと連携し、上海・深セン市場の完全な相場データ、財務指標、ファンダメンタルズ情報を取得します。

### ⚡ 7ステップ定量ワークフロー
完全可視化の分析パイプライン：コード検証 → 基本情報 → 市場サンプル → 財務指標 → ウェブ検索 → AI定量強化 → 完全レポート生成。

</td>
<td width="50%">

### 🔍 株式スクリーニング
業種セクター、価格帯、PER上限など多次元条件でのA株スクリーニング — ターゲット銘柄を素早く特定します。

### ⭐ ウォッチリスト
カスタム銘柄ウォッチリスト。リアルタイム相場、ポップアップKチャート（純SVG、542行）、銘柄詳細ビューを提供します。

### 📋 実行センター
すべての分析タスクを統合管理 — 実行中、完了、失敗のタスクを確認。いつでもプッシュ、停止、削除が可能です。

</td>
</tr>
</table>

<table>
<tr>
<td width="33%">

### 🔐 認証システム
JWTデュアルトークン認証（Access 12h + Refresh 7d）、HttpOnly Cookie、bcryptハッシュ、管理者ロール分離。

</td>
<td width="33%">

### 🌓 ダーク/ライトテーマ
丁寧に設計されたデザイントークンシステム。CSSカスタムプロパティによる完全なライト/ダークテーマサポート。

</td>
<td width="33%">

### 🏗️ サーバーレスネイティブ
シングルサービスアーキテクチャ、バックグラウンドプロセス不要。フロントエンドポーリング駆動、Vercelサーバーレスに最適。

</td>
</tr>
</table>

---

## 7ステップ分析パイプライン

```
┌─────────────────────────────────────────────────────────────┐
│                   定量分析フロー                              │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  ①   │    ②     │    ③     │    ④     │    ⑤     │    ⑥    │
│コード│  基本    │  市場    │  財務    │ ウェブ   │ AI定量   │
│検証  │  情報    │ サンプル │  指標    │  検索    │  強化    │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                                       ↓
                                              ⑦ 完全レポート生成
```

各ステップはリアルタイムで進捗を可視化。タスクはフロントエンドポーリングで駆動 — ページを閉じるとタスクは自動停止し、リソースの無駄を防ぎます。

---

## 技術スタック

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

| レイヤー | 技術 |
|:------|:-----------|
| フレームワーク | Next.js 15.5 (App Router) |
| フロントエンド | React 19, Tailwind CSS 4, Framer Motion |
| 型システム | TypeScript 5.9 (Strictモード) |
| データベース | MongoDB (ネイティブドライバー 6.x) |
| AIモデル | Google Gemini (gemini-3.1-pro-preview)、Search Grounding対応 |
| 市場データ | Tushare Pro（同時実行制御、レート制限、指数バックオフリトライ） |
| 認証 | JWT (jose) + bcryptjs、HttpOnly Cookie、デュアルトークン |
| ビジュアライゼーション | 純SVG Kチャート（542行、クロスヘア、予測データ分離） |
| UIコンポーネント | 完全手書き（外部UIライブラリ依存ゼロ） |
| デプロイ | Vercel Serverless（Function Max Duration: 800s） |

---

## デプロイ

Finance Agents は **Vercel Pro** デプロイメント向けに設計されています。ローカルランタイムは提供されません。

### 前提条件

- Vercel Pro アカウント
- MongoDB データベース（例：[MongoDB Atlas](https://www.mongodb.com/atlas) — 無料プランあり）
- [Google Gemini API Key](https://aistudio.google.com/)
- [Tushare Pro Token](https://tushare.pro/register)

### 環境変数

| 変数名 | 必須 | 用途 |
|:---------|:--------:|:--------|
| `MONGO_URI` | ✅ | MongoDB接続文字列 |
| `MONGODB_DB` | ✅ | データベース名 |
| `JWT_SECRET` | ✅ | 認証トークン署名シークレット |
| `GOOGLE_API_KEY` | ✅ | Google Gemini AIアクセス |
| `TUSHARE_TOKEN` | ✅ | Tushare Pro市場データアクセス |

### デプロイ手順

1. このリポジトリを **Fork** する
2. [Vercel](https://vercel.com/) → `Add New Project` → Forkしたリポジトリを選択してインポート
3. Vercelプロジェクト設定で**環境変数**を設定
4. Vercel → Settings → Functions → **Function Max Duration** を `800` 秒に設定
5. **Deploy** をクリックし、ビルド完了を待つ

---

## ロードマップ

- [x] JWTデュアルトークン認証システム
- [x] 7ステップ可視化定量分析ワークフロー
- [x] ダーク/ライトテーマ切り替え
- [x] 管理者パネル（データベース/キャッシュ/ログ/システムログ/スケジューラ）
- [x] 通知センター
- [x] Kチャート可視化（純SVG）
- [x] APIレート制限保護
- [x] 多次元株式スクリーニング
- [x] 実行センターのタスク管理
- [ ] 香港・米国株式市場サポート
- [ ] レポートエクスポート（PDF / Markdown）
- [ ] スクリーニング次元の拡充（ROE、純利益成長率、配当利回り等）
- [ ] ウォッチリストグルーピング＆タグ管理
- [ ] バッチ分析タスクキュー
- [ ] 分析テンプレートカスタマイズ
- [ ] モバイル体験の最適化
- [ ] 音声入力＆AIインタラクション

---

## コントリビューション

コントリビューションを歓迎します！バグ報告、機能リクエスト、プルリクエスト — すべて大歓迎です。

1. リポジトリをFork
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

---

## 免責事項

- 本プロジェクトは**学習および技術研究目的のみ**であり、**投資アドバイスを構成するものではありません**
- 株式データはTushare Proが提供、AI分析結果はGoogle Geminiが生成 — 参考情報としてのみご利用ください
- ご使用前にTushare、Google等のデータプロバイダーの利用規約を遵守してください

---

## ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。

---

<div align="center">

## Star 推移

<a href="https://star-history.com/#Noah-Wu66/Finance&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
 </picture>
</a>

<br/>
<br/>

**Finance Agents が役に立ったら、Starをお願いします！**

<br/>

[![Star this repo](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=social)](https://github.com/Noah-Wu66/Finance)

<br/>

---

<sub>情熱で構築。オープンソースで駆動。</sub>

</div>
