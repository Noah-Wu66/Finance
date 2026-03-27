<div align="center">

# 📊 Finance Agents

### AI 기반 지능형 중국 A주 퀀트 분석 플랫폼

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=gold)](https://github.com/Noah-Wu66/Finance/stargazers)
[![Forks](https://img.shields.io/github/forks/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=silver)](https://github.com/Noah-Wu66/Finance/network/members)
[![Issues](https://img.shields.io/github/issues/Noah-Wu66/Finance?style=for-the-badge&logo=github&color=orange)](https://github.com/Noah-Wu66/Finance/issues)
[![Deploy with Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Node](https://img.shields.io/badge/Node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br/>

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · **한국어**

<br/>

> **초기 단계 알림** — 이 프로젝트는 활발하게 개발 중입니다. 기능, API, UI가 자주 변경될 수 있습니다. 지속적인 업데이트와 개선에 전념하고 있습니다. 최신 소식을 받으려면 Star를 눌러주세요!

<br/>

<img src="https://img.shields.io/badge/Gemini_3.1_Pro-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini" />
<img src="https://img.shields.io/badge/Tushare_Pro-FF6A00?style=flat-square&logoColor=white" alt="Tushare" />
<img src="https://img.shields.io/badge/Next.js_15.5-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/TypeScript_5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />

</div>

---

## Finance Agents란?

Finance Agents는 **Google Gemini AI**와 **Tushare Pro 데이터 소스**를 기반으로 구축된 **오픈소스 A주 지능형 퀀트 분석 플랫폼**입니다. Next.js 풀스택 아키텍처를 통해 AI 분석 기능, 실시간 시장 데이터, 직관적인 시각화를 원활하게 통합하여 누구나 퀀트 분석에 접근할 수 있도록 합니다.

실시간 시장 개요, AI 기반 종목 분석 보고서, 다차원 종목 스크리닝 등 — Finance Agents가 모든 것을 지원합니다.

---

## 주요 기능

<table>
<tr>
<td width="50%">

### 🤖 AI 심층 분석
Google Gemini 탑재, 웹 검색 그라운딩 지원. 실시간 인터넷 데이터를 활용하여 포괄적인 종목 분석 보고서를 생성합니다.

### 📈 실시간 시장 데이터
Tushare Pro와 연동하여 상하이·선전 시장의 완전한 시세, 재무 지표, 펀더멘털 정보를 제공합니다.

### ⚡ 7단계 퀀트 워크플로우
완전 시각화 분석 파이프라인: 코드 검증 → 기본 정보 → 시장 샘플 → 재무 지표 → 웹 검색 → AI 퀀트 강화 → 전체 보고서 생성.

</td>
<td width="50%">

### 🔍 종목 스크리닝
산업 섹터, 가격대, PER 상한 등 다차원 조건으로 A주를 스크리닝하여 대상 종목을 빠르게 찾아냅니다.

### ⭐ 관심 종목 관리
맞춤형 종목 관심 목록, 실시간 시세, 팝업 K라인 차트(순수 SVG, 542줄), 상세 종목 뷰를 제공합니다.

### 📋 실행 센터
모든 분석 작업을 통합 관리 — 실행 중, 완료, 실패 작업을 확인하고 언제든 추진, 중지, 삭제할 수 있습니다.

</td>
</tr>
</table>

<table>
<tr>
<td width="33%">

### 🔐 인증 시스템
JWT 이중 토큰 인증(Access 12h + Refresh 7d), HttpOnly Cookie, bcrypt 해싱, 관리자 역할 격리.

</td>
<td width="33%">

### 🌓 다크/라이트 테마
세심하게 설계된 디자인 토큰 시스템. CSS 커스텀 프로퍼티를 통한 완전한 라이트/다크 테마 지원.

</td>
<td width="33%">

### 🏗️ 서버리스 네이티브
단일 서비스 아키텍처, 백그라운드 프로세스 불필요. 프론트엔드 폴링 구동으로 Vercel 서버리스에 최적화.

</td>
</tr>
</table>

---

## 7단계 분석 파이프라인

```
┌─────────────────────────────────────────────────────────────┐
│                     퀀트 분석 플로우                          │
├──────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  ①   │    ②     │    ③     │    ④     │    ⑤     │    ⑥    │
│코드  │  기본    │  시장    │  재무    │  웹     │ AI 퀀트  │
│검증  │  정보    │  샘플    │  지표    │  검색    │  강화    │
└──────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                                                       ↓
                                              ⑦ 전체 보고서 생성
```

각 단계는 실시간으로 진행 상황을 시각화합니다. 작업은 프론트엔드 폴링으로 구동되며 — 페이지를 닫으면 작업이 자동으로 중지되어 리소스 낭비를 방지합니다.

---

## 기술 스택

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

| 계층 | 기술 |
|:------|:-----------|
| 프레임워크 | Next.js 15.5 (App Router) |
| 프론트엔드 | React 19, Tailwind CSS 4, Framer Motion |
| 타입 시스템 | TypeScript 5.9 (Strict 모드) |
| 데이터베이스 | MongoDB (네이티브 드라이버 6.x) |
| AI 모델 | Google Gemini (gemini-3.1-pro-preview), Search Grounding 지원 |
| 시장 데이터 | Tushare Pro (동시 실행 제어, 속도 제한, 지수 백오프 재시도) |
| 인증 | JWT (jose) + bcryptjs, HttpOnly Cookie, 이중 토큰 메커니즘 |
| 시각화 | 순수 SVG K라인 차트 (542줄, 십자선, 예측 데이터 분리) |
| UI 컴포넌트 | 완전 수작업 (외부 UI 라이브러리 의존성 제로) |
| 배포 | Vercel Serverless (Function Max Duration: 800s) |

---

## 배포

Finance Agents는 **Vercel Pro** 배포를 위해 설계되었습니다. 로컬 런타임은 제공되지 않습니다.

### 사전 조건

- Vercel Pro 계정
- MongoDB 데이터베이스 (예: [MongoDB Atlas](https://www.mongodb.com/atlas) — 무료 플랜 제공)
- [Google Gemini API Key](https://aistudio.google.com/)
- [Tushare Pro Token](https://tushare.pro/register)

### 환경 변수

| 변수명 | 필수 | 용도 |
|:---------|:--------:|:--------|
| `MONGO_URI` | ✅ | MongoDB 연결 문자열 |
| `MONGODB_DB` | ✅ | 데이터베이스 이름 |
| `JWT_SECRET` | ✅ | 인증 토큰 서명 시크릿 |
| `GOOGLE_API_KEY` | ✅ | Google Gemini AI 액세스 |
| `TUSHARE_TOKEN` | ✅ | Tushare Pro 시장 데이터 액세스 |

### 배포 절차

1. 이 저장소를 **Fork** 합니다
2. [Vercel](https://vercel.com/) → `Add New Project` → Fork한 저장소를 선택하여 가져오기
3. Vercel 프로젝트 설정에서 **환경 변수** 구성
4. Vercel → Settings → Functions → **Function Max Duration**을 `800`초로 설정
5. **Deploy** 클릭 후 빌드 완료 대기

---

## 로드맵

- [x] JWT 이중 토큰 인증 시스템
- [x] 7단계 시각화 퀀트 분석 워크플로우
- [x] 다크/라이트 테마 전환
- [x] 관리자 패널 (데이터베이스/캐시/로그/시스템 로그/스케줄러)
- [x] 알림 센터
- [x] K라인 차트 시각화 (순수 SVG)
- [x] API 속도 제한 보호
- [x] 다차원 종목 스크리닝
- [x] 실행 센터 작업 관리
- [ ] 홍콩 및 미국 주식 시장 지원
- [ ] 보고서 내보내기 (PDF / Markdown)
- [ ] 스크리닝 차원 확장 (ROE, 순이익 성장률, 배당 수익률 등)
- [ ] 관심 종목 그룹핑 및 태그 관리
- [ ] 배치 분석 작업 큐
- [ ] 분석 템플릿 커스터마이징
- [ ] 모바일 경험 최적화
- [ ] 음성 입력 및 AI 상호작용

---

## 기여

기여를 환영합니다! 버그 보고, 기능 요청, 풀 리퀘스트 — 모든 기여를 소중히 여깁니다.

1. 저장소를 Fork
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경 사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

---

## 면책 조항

- 이 프로젝트는 **학습 및 기술 연구 목적으로만** 사용되며, **투자 조언을 구성하지 않습니다**
- 주식 데이터는 Tushare Pro에서 제공하고, AI 분석 결과는 Google Gemini가 생성합니다 — 참고용으로만 사용하세요
- 사용 전 Tushare, Google 등 데이터 제공업체의 이용 약관을 준수하시기 바랍니다

---

## 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 공개되어 있습니다.

---

<div align="center">

## Star 히스토리

<a href="https://star-history.com/#Noah-Wu66/Finance&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noah-Wu66/Finance&type=Date" />
 </picture>
</a>

<br/>
<br/>

**Finance Agents가 도움이 되셨다면 Star를 눌러주세요!**

<br/>

[![Star this repo](https://img.shields.io/github/stars/Noah-Wu66/Finance?style=social)](https://github.com/Noah-Wu66/Finance)

<br/>

---

<sub>열정으로 구축. 오픈소스로 구동.</sub>

</div>
