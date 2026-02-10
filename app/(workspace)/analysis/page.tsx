'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { StockDataPanel } from '@/components/stock-data-panel'
import { KlineChart } from '@/components/ui/kline-chart'

type Status = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

interface ExecutionLog {
  at: string
  text: string
}

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
  score: string
}

interface Execution {
  _id: string
  symbol: string
  market: string
  status: Status
  progress: number
  step: number
  total_steps: number
  logs: ExecutionLog[]
  result?: {
    report_id?: string
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
  }
}

interface SearchResult {
  symbol: string
  name: string
  market: string
}

function AnalysisPageContent() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [market, setMarket] = useState('A股')
  const depth = '全面' as const
  const [executionId, setExecutionId] = useState('')
  const [execution, setExecution] = useState<Execution | null>(null)
  const [loading, setLoading] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [error, setError] = useState('')

  // 搜索相关
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRunning = execution?.status === 'running'

  const progressText = useMemo(() => {
    if (!execution) return '暂无任务'
    return `${execution.progress}% (${execution.step}/${execution.total_steps})`
  }, [execution])

  const fetchExecution = async (id: string) => {
    const res = await apiFetch<Execution>(`/api/executions/${id}`)
    setExecution(res.data)
    return res.data
  }

  const runTick = async (id: string) => {
    setTicking(true)
    try {
      const res = await apiFetch<Execution>(`/api/executions/${id}/tick`, { method: 'POST' })
      setExecution(res.data)
      return res.data
    } finally {
      setTicking(false)
    }
  }

  const start = async () => {
    setError('')
    if (!symbol.trim()) {
      setError('请先选择一只股票')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch<{ execution_id: string }>('/api/executions', {
        method: 'POST',
        body: JSON.stringify({ symbol, market, depth })
      })

      const id = res.data.execution_id
      setExecutionId(id)
      await fetchExecution(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  const stop = async () => {
    if (!executionId) return
    await apiFetch(`/api/executions/${executionId}/cancel`, { method: 'POST' })
    await fetchExecution(executionId)
  }

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
    // 清除已选中状态
    setSymbol('')
    setSelectedName('')
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!value.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    timerRef.current = setTimeout(() => doSearch(value), 350)
  }

  const selectStock = (item: SearchResult) => {
    setSymbol(item.symbol)
    setSelectedName(item.name)
    setMarket(item.market)
    setKeyword(`${item.symbol} ${item.name}`)
    setShowResults(false)
    setResults([])
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

  useEffect(() => {
    if (!executionId) return

    let stopped = false
    
    const poll = async () => {
      if (stopped) return
      try {
        const data = await runTick(executionId)
        if (data.status !== 'running' || stopped) {
          return
        }
        setTimeout(poll, 2000)
      } catch {
      }
    }

    poll()

    return () => {
      stopped = true
    }
  }, [executionId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!executionId || execution?.status !== 'running') return
      fetch(`/api/executions/${executionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {})
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [execution?.status, executionId])

  // URL 参数中带 symbol 时自动填入
  useEffect(() => {
    const symbolFromQuery = (searchParams.get('symbol') || '').trim()
    if (symbolFromQuery) {
      setSymbol(symbolFromQuery)
      setKeyword(symbolFromQuery)
      // 尝试搜索获取股票名称
      apiFetch<SearchResult[]>(
        `/api/analysis/search?query=${encodeURIComponent(symbolFromQuery)}`
      ).then((res) => {
        const match = (res.data || []).find(
          (r) => r.symbol.toUpperCase() === symbolFromQuery.toUpperCase()
        )
        if (match) {
          setSelectedName(match.name)
          setMarket(match.market)
          setKeyword(`${match.symbol} ${match.name}`)
        }
      }).catch(() => {})
    }
  }, [searchParams])

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await apiFetch<{
          default_market?: string
        }>('/api/settings/preferences')
        if (res.data.default_market) {
          setMarket(res.data.default_market)
        }
      } catch {}
    }

    void loadPreferences()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="量化分析" description="发起 AI 分析任务，实时查看执行过程" />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Create Task */}
        <Card className="space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-[var(--fg)] m-0">创建分析任务</h3>
          <p className="text-xs text-[var(--fg-muted)] m-0">
            搜索并选择股票，点击开始分析。页面关闭后任务自动停止。
          </p>

          {/* 搜索选择股票 */}
          <div ref={searchRef} className="relative">
            <div className="relative">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="输入代码或名称搜索 …"
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                onFocus={() => { if (results.length > 0) setShowResults(true) }}
                className="
                  w-full h-10 pl-9 pr-4
                  rounded-lg border border-[var(--border)]
                  bg-[var(--bg)] text-sm text-[var(--fg)]
                  placeholder:text-[var(--fg-muted)]
                  focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
                  transition-all
                "
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>

            {/* 搜索结果下拉 */}
            {showResults && (
              <div className="
                absolute z-50 left-0 right-0 mt-1
                max-h-64 overflow-y-auto
                bg-[var(--card-bg)] border border-[var(--border)]
                rounded-lg shadow-[var(--card-shadow-lg)]
              ">
                {results.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--fg-muted)]">
                    未找到匹配的股票
                  </p>
                ) : (
                  results.map((item) => (
                    <button
                      key={`${item.symbol}-${item.market}`}
                      onClick={() => selectStock(item)}
                      className="
                        w-full flex items-center gap-2.5 px-3 py-2
                        text-left cursor-pointer
                        border-b border-[var(--border)] last:border-b-0
                        hover:bg-[var(--bg-hover)] transition-colors
                      "
                    >
                      <span className="font-mono text-sm font-medium text-[var(--fg)] shrink-0">
                        {item.symbol}
                      </span>
                      <span className="text-sm text-[var(--fg-secondary)] truncate">
                        {item.name}
                      </span>
                      <span className="
                        text-[11px] px-1.5 py-0.5 rounded ml-auto
                        bg-[var(--bg-secondary)] text-[var(--fg-muted)]
                        shrink-0
                      ">
                        {item.market}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 已选中提示 */}
          {symbol && selectedName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-700/10 border border-primary-200 dark:border-primary-700/30">
              <span className="font-mono text-sm font-medium text-primary-700 dark:text-primary-300">
                {symbol}
              </span>
              <span className="text-sm text-primary-600 dark:text-primary-400">
                {selectedName}
              </span>
              <span className="
                text-[11px] px-1.5 py-0.5 rounded ml-auto
                bg-primary-100 dark:bg-primary-700/20 text-primary-600 dark:text-primary-400
                shrink-0
              ">
                {market}
              </span>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="danger" onClick={stop} className="flex-1">
                停止
              </Button>
            ) : (
              <Button variant="primary" onClick={start} disabled={loading || !symbol} className="flex-1">
                {loading ? '创建中...' : '开始分析'}
              </Button>
            )}
          </div>
        </Card>

        {/* Right: Progress */}
        <Card className="h-[420px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between shrink-0 mb-4">
            <h3 className="text-sm font-semibold text-[var(--fg)] m-0">执行过程</h3>
            {execution && <StatusBadge status={execution.status} />}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {execution ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                  <ProgressBar value={execution.progress} showLabel />
                  <span className="text-xs font-mono text-[var(--fg-muted)]">{progressText}</span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--fg-secondary)]">
                  <span>任务 <span className="font-mono text-[var(--fg-muted)]">{execution._id.slice(0, 12)}</span></span>
                  <span>股票 <span className="font-mono font-medium">{execution.symbol}</span> · {execution.market}</span>
                </div>

                {/* Logs */}
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  {execution.logs?.map((log, idx) => (
                    <div
                      key={`${log.at}-${idx}`}
                      className="flex gap-3 px-3 py-2 text-xs border-b border-dashed border-[var(--border)] last:border-b-0"
                    >
                      <span className="font-mono text-[var(--fg-muted)] shrink-0">
                        {new Date(log.at).toLocaleTimeString()}
                      </span>
                      <span className="text-[var(--fg-secondary)]">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-faint)] mb-3">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p className="text-sm text-[var(--fg-muted)] m-0">在左侧搜索并选择股票开始分析</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 分析报告 */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--fg)] m-0 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          分析报告
          {execution?.result?.ai_powered && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-700/20 text-primary-600 dark:text-primary-400 font-medium">
              AI 深度分析
            </span>
          )}
        </h3>
        {execution?.status === 'completed' && execution.result ? (
          <div className="space-y-5">
            {/* 核心结论 */}
            <div className="rounded-lg border border-success-200 dark:border-success-700/30 bg-success-50 dark:bg-success-700/10 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-success-700 dark:text-success-400 m-0">核心结论</h4>
              <p className="text-sm text-success-700 dark:text-success-300 m-0 leading-relaxed">{execution.result.summary}</p>
            </div>

            {/* 操作建议 */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-2">
              <h4 className="text-sm font-semibold text-[var(--fg)] m-0">操作建议</h4>
              <p className="text-sm text-[var(--fg-secondary)] m-0 leading-relaxed">{execution.result.recommendation}</p>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[var(--border)]">
                <span className="text-xs text-[var(--fg-muted)]">
                  置信度：<span className="font-mono text-[var(--fg)] font-semibold">{execution.result.confidence_score ?? '-'}%</span>
                </span>
                <span className="text-xs text-[var(--fg-muted)]">
                  风险等级：<span className="font-mono text-[var(--fg)] font-semibold">{execution.result.risk_level ?? '-'}</span>
                </span>
              </div>
            </div>

            {/* 关键要点 */}
            {execution.result.key_points && execution.result.key_points.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-[var(--fg)] m-0">关键要点</h4>
                <ul className="space-y-1.5 pl-4 list-disc m-0">
                  {execution.result.key_points.map((point, idx) => (
                    <li key={idx} className="text-sm text-[var(--fg-secondary)] leading-relaxed">{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 相关新闻资讯 */}
            {execution.result.news && execution.result.news.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--fg)] m-0">相关新闻资讯</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--fg-muted)]">
                    {execution.result.news.length} 条 · {execution.result.search_rounds || 1} 轮搜索
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {execution.result.news.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors no-underline"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-[var(--fg-muted)] shrink-0 mt-0.5 font-mono">{item.date || '-'}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--fg)] m-0 font-medium truncate">{item.title}</p>
                          <p className="text-xs text-[var(--fg-muted)] m-0 mt-0.5 line-clamp-2">{item.snippet}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* K线预测图 */}
            {execution.result.predicted_kline && execution.result.predicted_kline.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider m-0">
                  K线走势预测（未来 {execution.result.predicted_kline.length} 个交易日）
                </h4>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 overflow-x-auto">
                  <KlineChart
                    data={[
                      ...(execution.result.kline_history || []).slice(-20),
                      ...execution.result.predicted_kline
                    ]}
                    width={720}
                    height={340}
                    predictStartIndex={(execution.result.kline_history || []).slice(-20).length}
                  />
                </div>
                <p className="text-[11px] text-[var(--fg-muted)] m-0">
                  虚线部分为 AI 预测走势，仅供参考，不构成投资建议。历史数据显示最近 20 个交易日。
                </p>
              </div>
            )}

            {execution.result.report_id && (
              <Link href={`/reports/${execution.result.report_id}`}>
                <Button variant="soft" size="sm">
                  查看完整报告
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-faint)] mb-3">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm text-[var(--fg-muted)] m-0">
              {isRunning ? '分析进行中，请等待...' : '分析完成后，报告将显示在这里'}
            </p>
          </div>
        )}
      </Card>

      {/* 股票详情数据面板 */}
      {symbol && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[var(--fg)] m-0 mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)]">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            股票详情
          </h3>
          <StockDataPanel symbol={symbol} />
        </Card>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisPageContent />
    </Suspense>
  )
}
