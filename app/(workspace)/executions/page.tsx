'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

type Status = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

interface Execution {
  _id: string
  symbol: string
  market: string
  depth: string
  status: Status
  progress: number
  updated_at: string
  created_at: string
  report_id?: string
  result?: { report_id?: string }
}

export default function ExecutionsPage() {
  const [items, setItems] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<Execution[]>('/api/executions?limit=100')
      setItems(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      if (autoAdvance) {
        void advanceRunning(false)
      } else {
        void load()
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [autoAdvance, autoRefresh, items])

  useEffect(() => {
    const hasRunning = items.some((item) => item.status === 'running')
    if (!hasRunning) return

    const handleBeforeUnload = () => {
      fetch('/api/executions/stop-running', {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [items])

  const advanceRunning = async (withLoading = true) => {
    if (withLoading) {
      setLoading(true)
    }

    try {
      const runningIds = items.filter((item) => item.status === 'running').map((item) => item._id)
      for (const id of runningIds) {
        await apiFetch(`/api/executions/${id}/tick`, { method: 'POST' })
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '推进失败')
      if (withLoading) {
        setLoading(false)
      }
    }
  }

  const pushStep = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}/tick`, { method: 'POST' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  const cancel = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}/cancel`, { method: 'POST' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="container execution-grid">
      <section className="card execution-top">
        <div>
          <h3>执行中心</h3>
          <p className="muted">你可以在这里看所有现场任务，并手动推进或停止。</p>
        </div>

        <div className="execution-actions">
          <label className="live-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            自动刷新
          </label>
          <label className="live-toggle">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
            自动推进运行中任务
          </label>
          <button className="btn btn-primary" onClick={() => advanceRunning()} disabled={loading}>
            推进全部运行中
          </button>
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '立即刷新'}
          </button>
          <Link className="btn btn-primary" href="/analysis">
            新建任务
          </Link>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {items.length === 0 ? (
          <p className="muted">暂无任务记录。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>任务ID</th>
                <th>股票</th>
                <th>状态</th>
                <th>进度</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const reportId = item.result?.report_id || item.report_id
                return (
                  <tr key={item._id}>
                    <td className="mono">{item._id.slice(0, 12)}...</td>
                    <td>
                      <div>{item.symbol}</div>
                      <small className="muted">{item.market} · {item.depth}</small>
                    </td>
                    <td>
                      <span className={`status status-${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      <div className="mini-progress">
                        <div style={{ width: `${item.progress}%` }} />
                      </div>
                      <small className="mono">{item.progress}%</small>
                    </td>
                    <td>{new Date(item.updated_at).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-soft"
                          onClick={() => pushStep(item._id)}
                          disabled={item.status !== 'running' || busyId === item._id}
                        >
                          推进一步
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => cancel(item._id)}
                          disabled={item.status !== 'running' || busyId === item._id}
                        >
                          停止
                        </button>
                        <button className="btn" onClick={() => remove(item._id)} disabled={busyId === item._id}>
                          删除
                        </button>
                        {reportId ? (
                          <Link className="btn btn-primary" href={`/reports/${reportId}`}>
                            查看报告
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
