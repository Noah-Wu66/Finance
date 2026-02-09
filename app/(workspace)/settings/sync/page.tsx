'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface SyncStatus {
  status: string
  total: number
  inserted: number
  updated: number
  errors: number
  message?: string
  finished_at?: string
}

interface SyncHistoryResp {
  records: SyncStatus[]
  total: number
  page: number
  page_size: number
}

export default function SettingsSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [history, setHistory] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, h] = await Promise.all([
        apiFetch<SyncStatus>('/api/sync/multi-source/status'),
        apiFetch<SyncHistoryResp>('/api/sync/multi-source/history?page=1&page_size=20')
      ])
      setStatus(s.data)
      setHistory(h.data.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const runSync = async () => {
    setRunning(true)
    setError('')
    try {
      await apiFetch('/api/sync/multi-source/stock_basics/run?force=true', {
        method: 'POST'
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>多数据源同步</h3>
          <p className="muted">已改为页面手动触发，点击按钮后立即执行。</p>
        </div>
        <div className="execution-actions">
          <button className="btn btn-primary" onClick={runSync} disabled={running}>
            {running ? '同步中...' : '立即同步'}
          </button>
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>当前状态</h4>
          <div className="value">{status?.status || '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>总数</h4>
          <div className="value">{status?.total ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>错误数</h4>
          <div className="value">{status?.errors ?? '-'}</div>
        </article>
      </section>

      <section className="card execution-list">
        <h4>同步历史</h4>
        {history.length === 0 ? (
          <p className="muted">暂无历史。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>状态</th>
                <th>总数</th>
                <th>新增</th>
                <th>更新</th>
                <th>错误</th>
                <th>完成时间</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => (
                <tr key={`${item.finished_at || item.message || idx}-${idx}`}>
                  <td>{item.status}</td>
                  <td>{item.total}</td>
                  <td>{item.inserted}</td>
                  <td>{item.updated}</td>
                  <td>{item.errors}</td>
                  <td>{item.finished_at ? new Date(item.finished_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
