'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface DbStatus {
  mongodb: {
    connected: boolean
    host: string
    port: number
    database: string
  }
  redis: {
    connected: boolean
    error?: string
  }
}

interface DbStats {
  total_collections: number
  total_documents: number
  collections: Array<{ name: string; documents: number }>
}

export default function SettingsDatabasePage() {
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, t] = await Promise.all([
        apiFetch<DbStatus>('/api/system/database/status'),
        apiFetch<DbStats>('/api/system/database/stats')
      ])
      setStatus(s.data)
      setStats(t.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>数据库管理</h3>
          <p className="muted">查看 MongoDB 当前状态与集合统计。</p>
        </div>
        <button className="btn btn-soft" onClick={load} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>MongoDB</h4>
          <div className="value">{status?.mongodb.connected ? '正常' : '异常'}</div>
        </article>
        <article className="card stat-card">
          <h4>集合总数</h4>
          <div className="value">{stats?.total_collections ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>文档总数</h4>
          <div className="value">{stats?.total_documents ?? '-'}</div>
        </article>
      </section>

      <section className="card execution-list">
        <h4>集合明细</h4>
        {!stats || stats.collections.length === 0 ? (
          <p className="muted">暂无数据。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>集合名</th>
                <th>文档数</th>
              </tr>
            </thead>
            <tbody>
              {stats.collections.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
