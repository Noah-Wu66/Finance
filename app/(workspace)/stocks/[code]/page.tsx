'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
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
    <div className="space-y-6">
      <PageHeader
        title="股票详情"
        description={params.code}
        actions={
          <Link href={`/analysis?symbol=${encodeURIComponent(params.code)}`}>
            <Button variant="primary">去量化分析</Button>
          </Link>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {info && (
        <Card>
          <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">
            {info.name}（{info.symbol}）
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--fg-muted)]">市场</p>
              <p className="text-sm font-medium text-[var(--fg)]">{info.market}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--fg-muted)]">价格</p>
              <p className="text-sm font-medium text-[var(--fg)]">{info.current_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--fg-muted)]">涨跌</p>
              <p className="text-sm font-medium text-[var(--fg)]">
                {info.change.toFixed(2)} / {info.change_percent.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--fg-muted)]">成交量</p>
              <p className="text-sm font-medium text-[var(--fg)]">{info.volume.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--fg-muted)]">PE</p>
              <p className="text-sm font-medium text-[var(--fg)]">{info.pe_ratio?.toFixed(2) ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--fg-muted)]">PB</p>
              <p className="text-sm font-medium text-[var(--fg)]">{info.pb_ratio?.toFixed(2) ?? '-'}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
