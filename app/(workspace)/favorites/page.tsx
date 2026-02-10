'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { apiFetch } from '@/lib/client-api'
import {
  Button,
  Card,
  PageHeader,
  Alert,
  Spinner,
  EmptyState,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@/components/ui'
import { StockDetailModal } from '@/components/stock-detail-modal'

interface SearchResult {
  symbol: string
  name: string
  market: string
}

interface FavoriteItem {
  stock_code: string
  stock_name: string
  market: string
  added_at: string
}

interface QuoteMap {
  [code: string]: { price: number; pct_chg: number; trade_date: string }
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 搜索相关
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [adding, setAdding] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStock, setDetailStock] = useState<{ symbol: string; name: string; market: string } | null>(null)

  // 加载自选股列表
  const loadFavorites = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<FavoriteItem[]>('/api/favorites')
      setItems(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载行情数据
  const loadQuotes = useCallback(async () => {
    try {
      const res = await apiFetch<QuoteMap>('/api/favorites/quotes')
      setQuotes(res.data || {})
    } catch {}
  }, [])

  useEffect(() => {
    void loadFavorites()
    void loadQuotes()
  }, [loadFavorites, loadQuotes])

  // 搜索股票（防抖）
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    try {
      const res = await apiFetch<SearchResult[]>(
        `/api/analysis/search?query=${encodeURIComponent(q.trim())}`
      )
      setResults(res.data || [])
      setShowResults(true)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const onKeywordChange = (value: string) => {
    setKeyword(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!value.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    timerRef.current = setTimeout(() => doSearch(value), 350)
  }

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 添加自选
  const addFavorite = async (item: SearchResult) => {
    setAdding(item.symbol)
    setError('')
    try {
      const res = await apiFetch<FavoriteItem[]>('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({
          stock_code: item.symbol,
          stock_name: item.name,
          market: item.market
        })
      })
      setItems(res.data || [])
      void loadQuotes()
      setKeyword('')
      setResults([])
      setShowResults(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    } finally {
      setAdding('')
    }
  }

  // 删除自选
  const removeFavorite = async (code: string) => {
    setError('')
    try {
      await apiFetch(`/api/favorites/${code}`, { method: 'DELETE' })
      await loadFavorites()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  // 判断是否已在自选中
  const isFavorited = (symbol: string) =>
    items.some((item) => item.stock_code === symbol.toUpperCase())

  return (
    <div className="space-y-6">
      <PageHeader title="自选股" description="搜索并添加你关注的股票，实时查看行情。" />

      {/* 搜索区域 */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="输入股票代码或名称搜索，例如 000001、平安银行、AAPL …"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true) }}
            className="
              w-full h-11 pl-10 pr-4
              rounded-xl border border-[var(--border)]
              bg-[var(--card-bg)] text-sm text-[var(--fg)]
              placeholder:text-[var(--fg-muted)]
              focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
              transition-all
            "
          />
          {searching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {/* 搜索结果下拉 */}
        {showResults && (
          <div className="
            absolute z-50 left-0 right-0 mt-1.5
            max-h-80 overflow-y-auto
            bg-[var(--card-bg)] border border-[var(--border)]
            rounded-xl shadow-[var(--card-shadow-lg)]
          ">
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--fg-muted)]">
                {keyword.trim() ? '未找到匹配的股票' : '请输入关键词'}
              </p>
            ) : (
              results.map((item) => {
                const exists = isFavorited(item.symbol)
                return (
                  <div
                    key={`${item.symbol}-${item.market}`}
                    className="
                      flex items-center justify-between gap-3
                      px-4 py-2.5
                      border-b border-[var(--border)] last:border-b-0
                      hover:bg-[var(--bg-hover)] transition-colors
                    "
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm font-medium text-[var(--fg)] shrink-0">
                        {item.symbol}
                      </span>
                      <span className="text-sm text-[var(--fg-secondary)] truncate">
                        {item.name}
                      </span>
                      <span className="
                        text-[11px] px-1.5 py-0.5 rounded
                        bg-[var(--bg-secondary)] text-[var(--fg-muted)]
                        shrink-0
                      ">
                        {item.market}
                      </span>
                    </div>
                    {exists ? (
                      <span className="text-xs text-[var(--fg-muted)] shrink-0">已添加</span>
                    ) : (
                      <button
                        onClick={() => addFavorite(item)}
                        disabled={adding === item.symbol}
                        className="
                          shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg
                          text-primary-600 dark:text-primary-400
                          hover:bg-primary-50 dark:hover:bg-primary-700/15
                          transition-colors cursor-pointer
                          disabled:opacity-50 disabled:cursor-not-allowed
                        "
                      >
                        {adding === item.symbol ? '添加中...' : '+ 添加'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* 自选股列表 */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="还没有自选股" description="在上方搜索框中搜索并添加你关注的股票" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>代码</Th>
                <Th>名称</Th>
                <Th>市场</Th>
                <Th className="text-right">最新价</Th>
                <Th className="text-right">涨跌幅</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => {
                const q = quotes[item.stock_code]
                const pct = q?.pct_chg ?? 0
                const colorClass =
                  pct > 0
                    ? 'text-danger-600 dark:text-danger-400'
                    : pct < 0
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-[var(--fg-secondary)]'

                return (
                  <Tr key={item.stock_code}>
                    <Td
                      className="font-mono font-medium cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      onClick={() => { setDetailStock({ symbol: item.stock_code, name: item.stock_name, market: item.market }); setDetailOpen(true) }}
                    >
                      {item.stock_code}
                    </Td>
                    <Td
                      className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      onClick={() => { setDetailStock({ symbol: item.stock_code, name: item.stock_name, market: item.market }); setDetailOpen(true) }}
                    >
                      {item.stock_name}
                    </Td>
                    <Td>
                      <span className="
                        text-[11px] px-1.5 py-0.5 rounded
                        bg-[var(--bg-secondary)] text-[var(--fg-muted)]
                      ">
                        {item.market}
                      </span>
                    </Td>
                    <Td className="text-right">
                      {q ? (
                        <span className={`font-mono tabular-nums ${colorClass}`}>
                          {q.price.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">-</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {q ? (
                        <span className={`font-mono tabular-nums font-medium ${colorClass}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">-</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => { setDetailStock({ symbol: item.stock_code, name: item.stock_name, market: item.market }); setDetailOpen(true) }}
                        >
                          详情
                        </Button>
                        <Link href={`/analysis?symbol=${encodeURIComponent(item.stock_code)}`}>
                          <Button variant="primary" size="sm">
                            量化分析
                          </Button>
                        </Link>
                        <Button variant="danger" size="sm" onClick={() => removeFavorite(item.stock_code)}>
                          删除
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* 股票详情弹窗 */}
      {detailStock && (
        <StockDetailModal
          symbol={detailStock.symbol}
          name={detailStock.name}
          market={detailStock.market}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  )
}
