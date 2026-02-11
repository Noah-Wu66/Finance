'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import {
  Button,
  Card,
  PageHeader,
  Alert,
  Spinner,
} from '@/components/ui'
import { KlineChart } from '@/components/ui/kline-chart'

interface KlineBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface NewsItem {
  title: string
  snippet: string
  date: string
  source: string
  link: string
}

interface BenchmarkSummaryItem {
  index_code: string
  latest_close: number
  day_change: number
  trend_20d: number
}

interface FundFlowItem {
  symbol: string
  trade_date: string
  main_inflow: number
  northbound_net?: number
  margin_balance?: number
  short_balance?: number
}

interface StockEventItem {
  symbol: string
  event_type: string
  event_date: string
  title: string
  impact: string
  url?: string
}

interface FinancialEnhancedItem {
  symbol: string
  report_period: string
  profit_yoy?: number
  gross_margin?: number
  debt_to_asset?: number
  operating_cashflow?: number
  ocf_to_profit?: number
}

interface NewsSentimentSummary {
  count: number
  avg_sentiment: number
  high_relevance_count: number
}

interface AdjustFactorItem {
  symbol: string
  ex_dividend_date: string
  adj_factor?: number
  fore_adj_factor?: number
  back_adj_factor?: number
}

interface CorporateActionItem {
  symbol: string
  action_type: string
  ex_dividend_date: string
  cash_dividend_ps?: number
  bonus_share_ps?: number
  reserve_to_stock_ps?: number
  rights_issue_price?: number
}

interface IndustryAggregationItem {
  industry_name: string
  trade_date: string
  industry_main_inflow?: number
  industry_sentiment?: number
  industry_heat?: number
}

interface EarningsExpectationItem {
  symbol: string
  announce_date: string
  source_type: string
  forecast_type?: string
  profit_change_pct?: number
  eps?: number
}

interface MacroCalendarItem {
  date: string
  indicator: string
  value?: number
  previous?: number
}

interface DataQualitySummary {
  total: number
  bad_count: number
  top_issues: string[]
}

interface IntradayItem {
  symbol: string
  datetime: string
  period: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  amount?: number
}

interface ReportDetail {
  _id: string
  analysis_id?: string
  stock_symbol: string
  stock_name?: string
  market_type?: string
  summary?: string
  recommendation?: string
  confidence_score?: number
  risk_level?: string
  key_points?: string[]
  predicted_kline?: KlineBar[]
  kline_history?: KlineBar[]
  next_trading_days?: string[]
  benchmark_summary?: BenchmarkSummaryItem[]
  fund_flow?: FundFlowItem[]
  stock_events?: StockEventItem[]
  financial_enhanced?: FinancialEnhancedItem | null
  news_sentiment_summary?: NewsSentimentSummary | null
  adjust_factors?: AdjustFactorItem[]
  corporate_actions?: CorporateActionItem[]
  industry_aggregation?: IndustryAggregationItem[]
  earnings_expectation?: EarningsExpectationItem[]
  macro_calendar?: MacroCalendarItem[]
  intraday_data?: IntradayItem[]
  data_quality_summary?: DataQualitySummary | null
  news?: NewsItem[]
  search_rounds?: number
  ai_powered?: boolean
  reports?: Record<string, unknown>
  created_at: string
}

function getT1Prediction(predicted: KlineBar[] | undefined) {
  if (!predicted || predicted.length === 0) return null
  const sorted = [...predicted].sort((a, b) => (a.time > b.time ? 1 : -1))
  const t1 = sorted[0]
  const open = Number(t1.open || 0)
  const close = Number(t1.close || 0)
  const deltaPct = open > 0 ? ((close - open) / open) * 100 : 0
  const isFlat = Math.abs(deltaPct) <= 0.15
  const trend = isFlat ? '浮动' : close > open ? '看涨' : '看跌'
  const colorClass = isFlat
    ? 'text-amber-600 dark:text-amber-400'
    : close > open
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-success-600 dark:text-success-400'

  return {
    time: t1.time,
    open,
    close,
    deltaPct,
    trend,
    colorClass
  }
}

function fmtDate(value?: string) {
  if (!value) return '-'
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }
  return value
}

function fmtNumber(value: number | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  return Number(value).toFixed(digits)
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newsExpanded, setNewsExpanded] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<ReportDetail>(`/api/reports/${params.id}`)
        setDetail(res.data)
        setNewsExpanded(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [params.id])

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      <PageHeader
        title="报告详情"
        description={
          detail
            ? `${detail.stock_name || detail.stock_symbol}（${detail.stock_symbol}）${detail.ai_powered ? ' · AI 深度分析' : ''}`
            : '正在加载...'
        }
        actions={
          <Link href="/executions">
            <Button variant="soft">返回执行中心</Button>
          </Link>
        }
      />

      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </Card>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {detail ? (
        <>
          <Card>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="px-3 py-2 rounded-lg bg-primary-100 dark:bg-primary-700/20 border border-primary-200 dark:border-primary-700/40">
                <p className="text-[11px] text-primary-700 dark:text-primary-300 m-0">置信度</p>
                  <p className="text-lg sm:text-xl font-bold text-primary-700 dark:text-primary-300 m-0 mt-0.5">
                    {detail.confidence_score ?? '-'}%
                  </p>
                </div>
              <div className="px-3 py-2 rounded-lg bg-orange-100 dark:bg-orange-700/20 border border-orange-200 dark:border-orange-700/40">
                <p className="text-[11px] text-orange-700 dark:text-orange-300 m-0">风险等级</p>
                  <p className="text-lg sm:text-xl font-bold text-orange-700 dark:text-orange-300 m-0 mt-0.5">
                    {detail.risk_level || '-'}
                  </p>
                </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-[var(--fg)] m-0">
                核心结论
              </h4>
              {detail.ai_powered && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-700/20 text-primary-600 dark:text-primary-400 font-medium">
                  AI 深度分析
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--fg-secondary)] leading-relaxed">
              {detail.summary || '-'}
            </p>
            <p className="text-sm text-[var(--fg-secondary)] leading-relaxed mt-2">
              {detail.recommendation || '-'}
            </p>
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--fg-muted)]">
                生成时间：
                <span className="text-[var(--fg-secondary)]">
                  {new Date(detail.created_at).toLocaleString()}
                </span>
              </span>
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">
              关键要点
            </h4>
            {detail.key_points && detail.key_points.length > 0 ? (
              <ul className="space-y-2 pl-4 list-disc">
                {detail.key_points.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="text-sm text-[var(--fg-secondary)] leading-relaxed"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">暂无关键要点。</p>
            )}
          </Card>

          {/* T+1 交易日预测 */}
          {(() => {
            const t1 = getT1Prediction(detail.predicted_kline)
            if (!t1) return null
            return (
              <Card>
                <h4 className="text-sm font-semibold text-[var(--fg)] mb-2">
                  T+1 交易日预测
                </h4>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-xs text-[var(--fg-muted)]">
                    预测日期：
                    <span className="font-mono text-[var(--fg-secondary)]">{t1.time}</span>
                  </span>
                  <span className={`text-base font-semibold ${t1.colorClass}`}>{t1.trend}</span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    开盘：<span className="font-mono text-[var(--fg-secondary)]">{t1.open.toFixed(2)}</span>
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    收盘：<span className="font-mono text-[var(--fg-secondary)]">{t1.close.toFixed(2)}</span>
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">
                    变化：
                    <span className={`font-mono ${t1.colorClass}`}>
                      {t1.deltaPct > 0 ? '+' : ''}
                      {t1.deltaPct.toFixed(2)}%
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-[var(--fg-muted)] m-0 mt-2">
                  浮动 = 开盘与收盘几乎一致（绝对涨跌幅不超过 0.15%）。
                </p>
              </Card>
            )
          })()}

          {/* 日K线（历史 + 预测合并） */}
          <Card>
            <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">
              日K线（近 41 日）
            </h4>
            {(() => {
              const history = [...(detail.kline_history || [])]
                .sort((a, b) => (a.time > b.time ? 1 : -1))
                .slice(-41)
              const predicted = [...(detail.predicted_kline || [])].sort((a, b) => (a.time > b.time ? 1 : -1))
              const merged = [...history, ...predicted]
              const predictStartIndex = predicted.length > 0 ? history.length : undefined

              return (
                <>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-2 sm:p-3 overflow-x-auto">
                    <div className="min-w-[700px]">
                      <KlineChart
                        data={merged}
                        width={760}
                        height={320}
                        predictStartIndex={predictStartIndex}
                      />
                    </div>
                  </div>
                  {predicted.length > 0 && (
                    <p className="text-[11px] text-[var(--fg-muted)] mt-2 m-0">
                      已合并量化分析预测：未来 {predicted.length} 个交易日为虚线部分，仅供参考。
                    </p>
                  )}
                </>
              )
            })()}
          </Card>

          {detail.next_trading_days && detail.next_trading_days.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">未来交易日历（10天）</h4>
              <div className="flex flex-wrap gap-2">
                {detail.next_trading_days.map((day) => (
                  <span
                    key={day}
                    className="text-xs px-2 py-1 rounded-md bg-[var(--bg-secondary)] text-[var(--fg-secondary)] font-mono"
                  >
                    {fmtDate(day)}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {detail.benchmark_summary && detail.benchmark_summary.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">基准指数对照</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detail.benchmark_summary.map((item) => (
                  <div key={item.index_code} className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{item.index_code}</p>
                    <p className="text-sm text-[var(--fg)] m-0 mt-1">
                      最新 {fmtNumber(item.latest_close, 2)}
                    </p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      当日 {item.day_change >= 0 ? '+' : ''}{fmtNumber(item.day_change, 2)}% · 20日 {item.trend_20d >= 0 ? '+' : ''}{fmtNumber(item.trend_20d, 2)}%
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.fund_flow && detail.fund_flow.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">资金流（近30条）</h4>
              <div className="space-y-2">
                {detail.fund_flow.slice(0, 20).map((row, idx) => (
                  <div key={`${row.trade_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{fmtDate(row.trade_date)}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      主力净流入 {fmtNumber(row.main_inflow, 2)}
                      {row.northbound_net != null ? ` · 北向净流入 ${fmtNumber(row.northbound_net, 2)}` : ''}
                      {row.margin_balance != null ? ` · 融资余额 ${fmtNumber(row.margin_balance, 2)}` : ''}
                      {row.short_balance != null ? ` · 融券余额 ${fmtNumber(row.short_balance, 2)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.stock_events && detail.stock_events.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">公告与事件（近50条）</h4>
              <div className="space-y-2">
                {detail.stock_events.slice(0, 20).map((item, idx) => (
                  <div key={`${item.event_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{fmtDate(item.event_date)} · {item.event_type} · 影响 {item.impact}</p>
                    <p className="text-sm text-[var(--fg)] m-0 mt-1">{item.title}</p>
                    {item.url ? (
                      <a className="text-xs text-primary-600 dark:text-primary-400 mt-1 inline-block" href={item.url} target="_blank" rel="noopener noreferrer">
                        查看原文
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(detail.financial_enhanced || detail.news_sentiment_summary) && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">增强指标</h4>
              {detail.financial_enhanced ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 mb-2">
                  <p className="text-xs text-[var(--fg-muted)] m-0">财务增强 · 报告期 {detail.financial_enhanced.report_period || '-'}</p>
                  <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                    净利润同比 {fmtNumber(detail.financial_enhanced.profit_yoy, 2)}% · 毛利率 {fmtNumber(detail.financial_enhanced.gross_margin, 2)}% · 资产负债率 {fmtNumber(detail.financial_enhanced.debt_to_asset, 2)}%
                  </p>
                  <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                    经营现金流 {fmtNumber(detail.financial_enhanced.operating_cashflow, 2)} · 经营现金流/净利润 {fmtNumber(detail.financial_enhanced.ocf_to_profit, 4)}
                  </p>
                </div>
              ) : null}
              {detail.news_sentiment_summary ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
                  <p className="text-xs text-[var(--fg-muted)] m-0">新闻情绪摘要</p>
                  <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                    样本 {detail.news_sentiment_summary.count} 条 · 平均情绪分 {fmtNumber(detail.news_sentiment_summary.avg_sentiment, 4)} · 高相关 {detail.news_sentiment_summary.high_relevance_count} 条
                  </p>
                </div>
              ) : null}
            </Card>
          )}

          {detail.adjust_factors && detail.adjust_factors.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">复权因子（近期）</h4>
              <div className="space-y-2">
                {detail.adjust_factors.slice(0, 15).map((item, idx) => (
                  <div key={`${item.ex_dividend_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">除权日 {fmtDate(item.ex_dividend_date)}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      当次因子 {fmtNumber(item.adj_factor, 6)} · 前复权 {fmtNumber(item.fore_adj_factor, 6)} · 后复权 {fmtNumber(item.back_adj_factor, 6)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.corporate_actions && detail.corporate_actions.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">公司行为（分红送转配股）</h4>
              <div className="space-y-2">
                {detail.corporate_actions.slice(0, 15).map((item, idx) => (
                  <div key={`${item.ex_dividend_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{fmtDate(item.ex_dividend_date)} · {item.action_type}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      现金分红/股 {fmtNumber(item.cash_dividend_ps, 4)} · 送转/股 {fmtNumber(item.bonus_share_ps, 4)} · 配股价 {fmtNumber(item.rights_issue_price, 4)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.industry_aggregation && detail.industry_aggregation.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">行业聚合（资金与情绪）</h4>
              <div className="space-y-2">
                {detail.industry_aggregation.slice(0, 10).map((item, idx) => (
                  <div key={`${item.trade_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{fmtDate(item.trade_date)} · {item.industry_name}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      主力净流入 {fmtNumber(item.industry_main_inflow, 2)} · 行业情绪 {fmtNumber(item.industry_sentiment, 2)} · 热度 {fmtNumber(item.industry_heat, 0)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.earnings_expectation && detail.earnings_expectation.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">业绩预期与预告</h4>
              <div className="space-y-2">
                {detail.earnings_expectation.slice(0, 15).map((item, idx) => (
                  <div key={`${item.announce_date}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{fmtDate(item.announce_date)} · {item.source_type} · {item.forecast_type || '-'}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      净利变动 {fmtNumber(item.profit_change_pct, 2)}% · EPS {fmtNumber(item.eps, 4)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.macro_calendar && detail.macro_calendar.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">宏观日历（最新）</h4>
              <div className="space-y-2">
                {detail.macro_calendar.slice(0, 12).map((item, idx) => (
                  <div key={`${item.date}-${item.indicator}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{item.date} · {item.indicator}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      当前值 {fmtNumber(item.value, 4)} · 前值 {fmtNumber(item.previous, 4)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.intraday_data && detail.intraday_data.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">分时盘口（最近1分钟）</h4>
              <div className="space-y-2">
                {detail.intraday_data.slice(0, 20).map((item, idx) => (
                  <div key={`${item.datetime}-${idx}`} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                    <p className="text-xs text-[var(--fg-muted)] m-0">{item.datetime}</p>
                    <p className="text-xs text-[var(--fg-secondary)] m-0 mt-1">
                      O {fmtNumber(item.open, 3)} · H {fmtNumber(item.high, 3)} · L {fmtNumber(item.low, 3)} · C {fmtNumber(item.close, 3)} · V {fmtNumber(item.volume, 0)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {detail.data_quality_summary && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">数据质量</h4>
              <p className="text-xs text-[var(--fg-secondary)] m-0">
                总记录 {detail.data_quality_summary.total} 条，异常 {detail.data_quality_summary.bad_count} 条
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(detail.data_quality_summary.top_issues || []).map((issue, idx) => (
                  <span key={`${issue}-${idx}`} className="text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300">
                    {issue}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* 相关新闻资讯 */}
          {detail.news && detail.news.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[var(--fg)] m-0">相关新闻资讯</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--fg-muted)]">
                  {detail.news.length} 条 · {detail.search_rounds || 1} 轮搜索
                </span>
              </div>
              <div className="space-y-2">
                {(newsExpanded ? detail.news : detail.news.slice(0, 5)).map((item, idx) => (
                  <a
                    key={`${item.link}-${idx}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors no-underline"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-[var(--fg-muted)] shrink-0 mt-0.5 font-mono">{item.date || '-'}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--fg)] m-0 font-medium">{item.title}</p>
                        <p className="text-xs text-[var(--fg-muted)] m-0 mt-0.5 line-clamp-2">{item.snippet}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
              {detail.news.length > 5 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <Button variant="soft" size="sm" onClick={() => setNewsExpanded((v) => !v)}>
                    {newsExpanded ? '收起新闻' : `展开全部新闻（${detail.news.length} 条）`}
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Card>
            <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">
              原始结构数据
            </h4>
            <pre className="text-xs font-mono leading-relaxed text-[var(--fg-secondary)] bg-[var(--bg-secondary)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(detail.reports || {}, null, 2)}
            </pre>
          </Card>
        </>
      ) : null}
    </div>
  )
}
