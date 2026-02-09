'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface ReportItem {
  _id: string
  analysis_id: string
  stock_symbol: string
  stock_name?: string
  market_type?: string
  summary?: string
  confidence_score?: number
  risk_level?: string
  created_at: string
}

interface ReportResponse {
  items: ReportItem[]
  total: number
  page: number
  page_size: number
}

export default function ReportsPage() {
  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<ReportResponse>('/api/reports?page=1&page_size=100')
      setItems(res.data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/reports/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>报告中心</h3>
          <p className="muted">这里展示你在页面现场执行后生成的全部分析报告。</p>
        </div>
        <button className="btn btn-soft" onClick={load} disabled={loading}>
          {loading ? '刷新中...' : '刷新列表'}
        </button>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {items.length === 0 ? (
          <p className="muted">暂无报告。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>股票</th>
                <th>摘要</th>
                <th>置信度</th>
                <th>风险</th>
                <th>生成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div className="mono">{item.stock_symbol}</div>
                    <small className="muted">{item.stock_name || '-'} · {item.market_type || '-'}</small>
                  </td>
                  <td>{item.summary || '-'}</td>
                  <td>{item.confidence_score ?? '-'}</td>
                  <td>{item.risk_level ?? '-'}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-primary" href={`/reports/${item._id}`}>
                        查看详情
                      </Link>
                      <button
                        className="btn btn-danger"
                        onClick={() => remove(item._id)}
                        disabled={busyId === item._id}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
