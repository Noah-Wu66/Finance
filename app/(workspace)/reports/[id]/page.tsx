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

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<ReportDetail>(`/api/reports/${params.id}`)
        setDetail(res.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [params.id])

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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
                置信度：
                <span className="font-mono text-[var(--fg-secondary)] font-medium">
                  {detail.confidence_score ?? '-'}%
                </span>
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                风险等级：
                <span className="font-mono text-[var(--fg-secondary)] font-medium">
                  {detail.risk_level ?? '-'}
                </span>
              </span>
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

          {/* K线预测图 */}
          {detail.predicted_kline && detail.predicted_kline.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">
                K线走势预测（未来 {detail.predicted_kline.length} 个交易日）
              </h4>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 overflow-x-auto">
                <KlineChart
                  data={[
                    ...(detail.kline_history || []).slice(-20),
                    ...detail.predicted_kline
                  ]}
                  width={720}
                  height={340}
                  predictStartIndex={(detail.kline_history || []).slice(-20).length}
                />
              </div>
              <p className="text-[11px] text-[var(--fg-muted)] mt-2 m-0">
                虚线部分为 AI 预测走势，仅供参考，不构成投资建议。
              </p>
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
                {detail.news.map((item, idx) => (
                  <a
                    key={idx}
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
