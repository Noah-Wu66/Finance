'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { apiFetch } from '@/lib/client-api'

type Status = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

interface ExecutionLog {
  at: string
  text: string
}

interface Execution {
  _id: string
  symbol: string
  market: string
  depth: '快速' | '标准' | '深度'
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
const depthList: Array<Execution['depth']> = ['快速', '标准', '深度']

export default function AnalysisPage() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState('')
  const [market, setMarket] = useState('A股')
  const [depth, setDepth] = useState<Execution['depth']>('标准')
  const [executionId, setExecutionId] = useState('')
  const [execution, setExecution] = useState<Execution | null>(null)
  const [loading, setLoading] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [autoRun, setAutoRun] = useState(true)
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
    if (!executionId || !autoRun) return

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
  }, [autoRun, executionId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!executionId || execution?.status !== 'running') return
      fetch(`/api/executions/${executionId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {
      })
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
          default_depth?: string
          auto_refresh?: boolean
        }>('/api/settings/preferences')
        if (res.data.default_market) {
          setMarket(res.data.default_market)
        }
        if (res.data.default_depth && depthList.includes(res.data.default_depth as Execution['depth'])) {
          setDepth(res.data.default_depth as Execution['depth'])
        }
        if (typeof res.data.auto_refresh === 'boolean') {
          setAutoRun(res.data.auto_refresh)
        }
      } catch {
      }
    }

    void loadPreferences()
  }, [])

  return (
    <div className="container live-grid">
      <section className="card live-start">
        <h3>创建现场执行任务</h3>
        <p className="muted">你在这里点“开始”，页面就会一边执行一边展示过程。页面关闭后任务会自动停止。</p>

        <div className="live-form">
          <div className="field">
            <label>股票代码</label>
            <input
              className="input mono"
              placeholder="例如 000001 或 AAPL"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            />
          </div>

          <div className="field">
            <label>市场</label>
            <select className="select" value={market} onChange={(event) => setMarket(event.target.value)}>
              {marketList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>深度</label>
            <select className="select" value={depth} onChange={(event) => setDepth(event.target.value as Execution['depth'])}>
              {depthList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="board-error">{error}</div> : null}

        <div className="live-actions">
          <button className="btn btn-primary" onClick={start} disabled={loading}>
            {loading ? '创建中...' : '开始现场执行'}
          </button>

          <button className="btn btn-soft" onClick={() => executionId && runTick(executionId)} disabled={!executionId || ticking}>
            {ticking ? '推进中...' : '手动推进一步'}
          </button>

          <button className="btn btn-danger" onClick={stop} disabled={!isRunning}>
            立即停止
          </button>
        </div>

        <label className="live-toggle">
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
          自动持续推进（建议开启）
        </label>
      </section>

      <section className="card live-progress">
        <div className="live-progress-head">
          <h3>执行过程</h3>
          {execution ? <span className={`status status-${execution.status}`}>{execution.status}</span> : null}
        </div>

        {execution ? (
          <>
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${execution.progress}%` }} />
              </div>
              <span className="mono">{progressText}</span>
            </div>

            <div className="live-meta">
              <div>任务ID：<span className="mono">{execution._id}</span></div>
              <div>股票：<span className="mono">{execution.symbol}</span> · {execution.market} · {execution.depth}</div>
            </div>

            <div className="log-list">
              {execution.logs?.map((log, idx) => (
                <div className="log-item" key={`${log.at}-${idx}`}>
                  <span className="mono">{new Date(log.at).toLocaleTimeString()}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>

            {execution.status === 'completed' && execution.result ? (
              <div className="result-box">
                <h4>执行结果</h4>
                <p>{execution.result.summary}</p>
                <p>{execution.result.recommendation}</p>
                <p>
                  置信度：{execution.result.confidence_score ?? '-'}，风险：{execution.result.risk_level ?? '-'}
                </p>
                {execution.result.report_id ? (
                  <Link className="btn btn-soft" href={`/reports/${execution.result.report_id}`}>
                    打开报告详情
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">还没有现场任务，先在左侧创建一个。</p>
        )}
      </section>
    </div>
  )
}
