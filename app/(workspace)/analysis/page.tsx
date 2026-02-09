'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'

type Status = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

interface ExecutionLog {
  at: string
  text: string
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
  }
}

const marketList = ['A股', '港股', '美股']

function AnalysisPageContent() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState('')
  const [market, setMarket] = useState('A股')
  const depth = '全面' as const
  const [executionId, setExecutionId] = useState('')
  const [execution, setExecution] = useState<Execution | null>(null)
  const [loading, setLoading] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [error, setError] = useState('')

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
      setError('请先输入股票代码')
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

  useEffect(() => {
    if (!executionId) return

    const timer = window.setInterval(async () => {
      try {
        const data = await runTick(executionId)
        if (data.status !== 'running') {
          window.clearInterval(timer)
        }
      } catch {
        window.clearInterval(timer)
      }
    }, 2200)

    return () => window.clearInterval(timer)
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

  useEffect(() => {
    const symbolFromQuery = (searchParams.get('symbol') || '').trim()
    if (symbolFromQuery) {
      setSymbol(symbolFromQuery)
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
      <PageHeader title="现场分析" description="发起 AI 分析任务，实时查看执行过程" />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Create Task */}
        <Card className="space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-[var(--fg)] m-0">创建分析任务</h3>
          <p className="text-xs text-[var(--fg-muted)] m-0">
            输入股票代码开始分析，页面关闭后任务自动停止。
          </p>

          <div className="space-y-3">
            <Input
              label="股票代码"
              placeholder="例如 000001 或 AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="font-mono"
            />

            <Select
              label="市场"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              {marketList.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="danger" onClick={stop} className="flex-1">
                停止
              </Button>
            ) : (
              <Button variant="primary" onClick={start} disabled={loading} className="flex-1">
                {loading ? '创建中...' : '开始分析'}
              </Button>
            )}
          </div>
        </Card>

        {/* Right: Progress */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--fg)] m-0">执行过程</h3>
            {execution && <StatusBadge status={execution.status} />}
          </div>

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
              <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-72 overflow-y-auto">
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

              {/* Result */}
              {execution.status === 'completed' && execution.result && (
                <div className="rounded-lg border border-success-200 dark:border-success-700/30 bg-success-50 dark:bg-success-700/10 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-success-700 dark:text-success-400 m-0">分析完成</h4>
                  <p className="text-sm text-success-700 dark:text-success-300 m-0">{execution.result.summary}</p>
                  <p className="text-sm text-success-700 dark:text-success-300 m-0">{execution.result.recommendation}</p>
                  <p className="text-xs text-success-600 dark:text-success-400 m-0">
                    置信度：{execution.result.confidence_score ?? '-'}，风险：{execution.result.risk_level ?? '-'}
                  </p>
                  {execution.result.report_id && (
                    <Link href={`/reports/${execution.result.report_id}`}>
                      <Button variant="soft" size="sm" className="mt-2">
                        查看报告详情
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-faint)] mb-3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-sm text-[var(--fg-muted)] m-0">在左侧输入股票代码开始分析</p>
            </div>
          )}
        </Card>
      </div>
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
