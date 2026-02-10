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
