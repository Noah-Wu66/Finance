'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Spinner } from '@/components/ui/spinner'
import { KlineChart } from '@/components/ui/kline-chart'

interface StockDataPanelProps {
  symbol: string
  className?: string
  klineLimit?: number
  predictedKline?: KlineBar[]
}

interface QuoteData {
  price: number
  change_percent: number
  amount: number
  trade_date: string
  open: number
  high: number
  low: number
  turnover_rate: number
  amplitude: number
}

interface FundaData {
  pe: number
  pb: number
  ps: number
  roe: number
  total_mv: number
  circ_mv: number
  industry: string
  debt_ratio: number
}

interface KlineBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function StockDataPanel({
  symbol,
  className = '',
  klineLimit = 60,
  predictedKline = []
}: StockDataPanelProps) {
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [funda, setFunda] = useState<FundaData | null>(null)
  const [kline, setKline] = useState<KlineBar[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    try {
      const [qRes, fRes, kRes] = await Promise.all([
        apiFetch<{
          price: number
          change_percent: number
          amount: number
          trade_date: string
          turnover_rate: number
          amplitude: number
        }>(`/api/stocks/${symbol}/quote`).catch(() => null),
        apiFetch<{
          pe: number; pb: number; ps: number; roe: number
          total_mv: number; circ_mv: number; industry: string; debt_ratio: number
        }>(`/api/stocks/${symbol}/fundamentals`).catch(() => null),
        apiFetch<{ items: KlineBar[] }>(`/api/stocks/${symbol}/kline?limit=${klineLimit}`).catch(() => null)
      ])

      if (qRes?.data) {
        setQuote({
          price: qRes.data.price,
          change_percent: qRes.data.change_percent,
          amount: qRes.data.amount,
          trade_date: qRes.data.trade_date,
          open: 0,
          high: 0,
          low: 0,
          turnover_rate: qRes.data.turnover_rate,
          amplitude: qRes.data.amplitude
        })
      }
      if (fRes?.data) {
        setFunda({
          pe: fRes.data.pe ?? 0,
          pb: fRes.data.pb ?? 0,
          ps: fRes.data.ps ?? 0,
          roe: fRes.data.roe ?? 0,
          total_mv: fRes.data.total_mv ?? 0,
          circ_mv: fRes.data.circ_mv ?? 0,
          industry: fRes.data.industry ?? '',
          debt_ratio: fRes.data.debt_ratio ?? 0
        })
      }
      if (kRes?.data?.items) {
        const sorted = [...kRes.data.items].sort((a, b) => (a.time > b.time ? 1 : -1))
        setKline(sorted)
      }
    } catch {}
    setLoading(false)
  }, [symbol, klineLimit])

  useEffect(() => {
    if (symbol) {
      setQuote(null)
      setFunda(null)
      setKline([])
      void load()
    }
  }, [symbol, load])

  const pct = quote?.change_percent ?? 0
  const up = pct > 0
  const down = pct < 0
  const colorClass = up
    ? 'text-danger-600 dark:text-danger-400'
    : down
      ? 'text-success-600 dark:text-success-400'
      : 'text-[var(--fg)]'

  const fmtMv = (v: number) => {
    if (!v) return '-'
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)} 万亿`
    if (v >= 1e8) return `${(v / 1e8).toFixed(2)} 亿`
    if (v >= 1e4) return `${(v / 1e4).toFixed(0)} 万`
    return v.toFixed(2)
  }

  const fmtVal = (v: number | undefined) =>
    v !== undefined && v !== 0 ? v.toFixed(2) : '-'

  const fmtPct = (v: number | undefined) =>
    v !== undefined && v !== 0 ? `${v.toFixed(2)}%` : '-'

  const sortedPredicted = [...predictedKline].sort((a, b) => (a.time > b.time ? 1 : -1))
  const mergedKline = [...kline, ...sortedPredicted]
  const predictStartIndex = sortedPredicted.length > 0 ? kline.length : undefined

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* 行情概览 */}
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className={`text-3xl font-semibold tabular-nums ${colorClass}`}>
          {quote ? quote.price.toFixed(2) : '-'}
        </span>
        {quote && (
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono tabular-nums font-medium ${colorClass}`}>
              {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* 交易数据 */}
      {quote && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '成交额', value: fmtMv(quote.amount) },
            { label: '换手率', value: fmtPct(quote.turnover_rate) },
            { label: '振幅', value: fmtPct(quote.amplitude) },
            { label: '交易日', value: quote.trade_date || '-' }
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
              <p className="text-[11px] text-[var(--fg-muted)] m-0">{item.label}</p>
              <p className="text-sm font-medium text-[var(--fg-secondary)] m-0 mt-0.5 tabular-nums font-mono">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* K 线图 */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
          日K线 (近 {kline.length} 日)
        </h4>
        <div className="
          rounded-xl border border-[var(--border)]
          bg-[var(--bg-secondary)] p-3
          overflow-x-auto
        ">
          <KlineChart
            data={mergedKline}
            width={660}
            height={320}
            predictStartIndex={predictStartIndex}
          />
        </div>
        {sortedPredicted.length > 0 && (
          <p className="text-[11px] text-[var(--fg-muted)] m-0 mt-2">
            已合并量化分析预测：未来 {sortedPredicted.length} 个交易日为虚线部分，仅供参考。
          </p>
        )}
      </div>

      {/* 基本面 */}
      {funda && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
            基本面指标
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '市盈率(PE)', value: fmtVal(funda.pe) },
              { label: '市净率(PB)', value: fmtVal(funda.pb) },
              { label: '市销率(PS)', value: fmtVal(funda.ps) },
              { label: 'ROE', value: fmtPct(funda.roe) },
              { label: '总市值', value: fmtMv(funda.total_mv) },
              { label: '流通市值', value: fmtMv(funda.circ_mv) },
              { label: '资产负债率', value: fmtPct(funda.debt_ratio) },
              { label: '所属行业', value: funda.industry || '-' }
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                <p className="text-[11px] text-[var(--fg-muted)] m-0">{item.label}</p>
                <p className="text-sm font-medium text-[var(--fg-secondary)] m-0 mt-0.5 tabular-nums">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
