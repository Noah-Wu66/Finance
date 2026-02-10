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
            ? `${detail.stock_name || detail.stock_symbol}（${detail.stock_symbol}）`
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
            <h4 className="text-sm font-semibold text-[var(--fg)] mb-3">
              核心结论
            </h4>
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
                  {detail.confidence_score ?? '-'}
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
