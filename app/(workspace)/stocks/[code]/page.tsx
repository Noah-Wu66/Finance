'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface StockInfo {
  symbol: string
  name: string
  market: string
  current_price: number
  change: number
  change_percent: number
  volume: number
  pe_ratio?: number
  pb_ratio?: number
}

export default function StockDetailPage() {
  const params = useParams<{ code: string }>()
  const [info, setInfo] = useState<StockInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<StockInfo>(`/api/analysis/stock-info?symbol=${encodeURIComponent(params.code)}`)
        setInfo(res.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [params.code])

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>股票详情</h3>
          <p className="muted">{params.code}</p>
        </div>
        <Link className="btn btn-primary" href={`/analysis?symbol=${encodeURIComponent(params.code)}`}>
          去现场分析
        </Link>
      </section>

      {loading ? <div className="card report-panel">加载中...</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      {info ? (
        <section className="card report-panel">
          <h4>{info.name}（{info.symbol}）</h4>
          <div className="report-metrics">
            <span>市场：{info.market}</span>
            <span>价格：{info.current_price.toFixed(2)}</span>
            <span>涨跌：{info.change.toFixed(2)} / {info.change_percent.toFixed(2)}%</span>
            <span>成交量：{info.volume.toLocaleString()}</span>
            <span>PE：{info.pe_ratio?.toFixed(2) ?? '-'}</span>
            <span>PB：{info.pb_ratio?.toFixed(2) ?? '-'}</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}
