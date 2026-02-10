'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'

interface IndexItem {
  code: string
  name: string
  price: number
  change: number
  pct_chg: number
  open: number
  high: number
  low: number
  pre_close: number
  volume: number
  amount: number
}

interface FavoriteItem {
  stock_code: string
  stock_name: string
  market: string
}

interface QuoteMap {
  [code: string]: { price: number; pct_chg: number; trade_date: string }
}

export default function DashboardPage() {
  const [indices, setIndices] = useState<IndexItem[]>([])
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [loadingIndices, setLoadingIndices] = useState(true)
  const [loadingFav, setLoadingFav] = useState(true)

  const loadIndices = useCallback(async () => {
    setLoadingIndices(true)
    try {
      const res = await apiFetch<IndexItem[]>('/api/dashboard/indices')
      setIndices(res.data || [])
    } catch {}
    setLoadingIndices(false)
  }, [])

  const loadFavorites = useCallback(async () => {
    setLoadingFav(true)
    try {
      const [favRes, quoteRes] = await Promise.all([
        apiFetch<FavoriteItem[]>('/api/favorites'),
        apiFetch<QuoteMap>('/api/favorites/quotes')
      ])
      setFavorites((favRes.data || []).slice(0, 10))
      setQuotes(quoteRes.data || {})
    } catch {}
    setLoadingFav(false)
  }, [])

  useEffect(() => {
    void loadIndices()
    void loadFavorites()
  }, [loadIndices, loadFavorites])

  const refreshAll = () => {
    void loadIndices()
    void loadFavorites()
  }

  const isLoading = loadingIndices || loadingFav

  /** 格式化大数字（成交额用） */
  const fmtAmount = (v: number) => {
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)} 万亿`
    if (v >= 1e8) return `${(v / 1e8).toFixed(2)} 亿`
    if (v >= 1e4) return `${(v / 1e4).toFixed(0)} 万`
    return String(v)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="总览"
        description="大盘指数与自选股行情一览"
        actions={
          <Button variant="secondary" onClick={refreshAll} disabled={isLoading}>
            {isLoading && <Spinner size="sm" />}
            刷新
          </Button>
        }
      />

      {/* 四大指数 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingIndices && indices.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-center py-6">
                <Spinner size="sm" />
              </div>
            </Card>
          ))
        ) : (
          indices.map((item) => {
            const up = item.pct_chg > 0
            const down = item.pct_chg < 0
            const colorClass = up
              ? 'text-danger-600 dark:text-danger-400'
              : down
                ? 'text-success-600 dark:text-success-400'
                : 'text-[var(--fg)]'
            const bgClass = up
              ? 'bg-danger-50 dark:bg-danger-700/10 border-danger-200 dark:border-danger-700/30'
              : down
                ? 'bg-success-50 dark:bg-success-700/10 border-success-200 dark:border-success-700/30'
                : ''

            return (
              <Card key={item.code} className={`p-4 border ${bgClass}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{item.name}</span>
                  <span className="text-[11px] text-[var(--fg-faint)] font-mono">{item.code}</span>
                </div>
                {item.price > 0 ? (
                  <>
                    <p className={`text-xl font-semibold tabular-nums m-0 ${colorClass}`}>
                      {item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-mono tabular-nums font-medium ${colorClass}`}>
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}
                      </span>
                      <span className={`text-xs font-mono tabular-nums font-medium ${colorClass}`}>
                        {item.pct_chg > 0 ? '+' : ''}{item.pct_chg.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-[11px] text-[var(--fg-muted)]">
                        成交额 <span className="text-[var(--fg-secondary)]">{fmtAmount(item.amount)}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)] m-0 mt-2">暂无数据</p>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* 自选股行情 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--fg-secondary)] m-0">自选股行情</h3>
          <Link
            href="/favorites"
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            查看全部 →
          </Link>
        </div>

        {loadingFav ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          </Card>
        ) : favorites.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-[var(--fg-muted)] m-0 mb-3">还没有自选股</p>
            <Link href="/favorites">
              <Button variant="soft" size="sm">去添加自选股</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {favorites.map((fav) => {
              const q = quotes[fav.stock_code]
              const pct = q?.pct_chg ?? 0
              const up = pct > 0
              const down = pct < 0
              const colorClass = up
                ? 'text-danger-600 dark:text-danger-400'
                : down
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-[var(--fg-secondary)]'
              const bgClass = up
                ? 'hover:border-danger-200 dark:hover:border-danger-700/40'
                : down
                  ? 'hover:border-success-200 dark:hover:border-success-700/40'
                  : 'hover:border-[var(--fg-muted)]'

              return (
                <Link
                  key={fav.stock_code}
                  href={`/analysis?symbol=${encodeURIComponent(fav.stock_code)}`}
                >
                  <Card
                    className={`p-3.5 cursor-pointer transition-all duration-200 hover:shadow-[var(--card-shadow-lg)] ${bgClass}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[var(--fg)] truncate">
                        {fav.stock_name}
                      </span>
                      <span className="
                        text-[10px] px-1.5 py-0.5 rounded
                        bg-[var(--bg-secondary)] text-[var(--fg-muted)]
                        shrink-0 ml-1
                      ">
                        {fav.market}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[var(--fg-muted)] m-0 mb-2">
                      {fav.stock_code}
                    </p>
                    {q ? (
                      <div className="flex items-baseline justify-between">
                        <span className={`text-lg font-semibold tabular-nums ${colorClass}`}>
                          {q.price.toFixed(2)}
                        </span>
                        <span className={`text-xs font-mono tabular-nums font-medium ${colorClass}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--fg-muted)] m-0">暂无行情</p>
                    )}
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
