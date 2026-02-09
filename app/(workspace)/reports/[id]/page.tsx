'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

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
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>报告详情</h3>
          <p className="muted">{detail ? `${detail.stock_name || detail.stock_symbol}（${detail.stock_symbol}）` : '正在加载...'}</p>
        </div>
        <Link className="btn btn-soft" href="/reports">
          返回列表
        </Link>
      </section>

      {loading ? <div className="card report-panel">正在加载报告...</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      {detail ? (
        <>
          <section className="card report-panel">
            <h4>核心结论</h4>
            <p>{detail.summary || '-'}</p>
            <p>{detail.recommendation || '-'}</p>
            <div className="report-metrics">
              <span>置信度：{detail.confidence_score ?? '-'}</span>
              <span>风险等级：{detail.risk_level ?? '-'}</span>
              <span>生成时间：{new Date(detail.created_at).toLocaleString()}</span>
            </div>
          </section>

          <section className="card report-panel">
            <h4>关键要点</h4>
            {detail.key_points && detail.key_points.length > 0 ? (
              <ul className="report-list">
                {detail.key_points.map((point, index) => (
                  <li key={`${point}-${index}`}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无关键要点。</p>
            )}
          </section>

          <section className="card report-panel">
            <h4>原始结构数据</h4>
            <pre className="raw-block">{JSON.stringify(detail.reports || {}, null, 2)}</pre>
          </section>
        </>
      ) : null}
    </div>
  )
}
