'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface UsageStats {
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
}

interface UsageRecord {
  id: string
  timestamp: string
  provider: string
  model_name: string
  input_tokens: number
  output_tokens: number
  cost: number
}

export default function SettingsUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, r] = await Promise.all([
        apiFetch<UsageStats>('/api/usage/statistics'),
        apiFetch<{ records: UsageRecord[] }>('/api/usage/records?limit=100')
      ])
      setStats(s.data)
      setRecords(r.data.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const cleanup = async () => {
    await apiFetch('/api/usage/records/old?days=90', { method: 'DELETE' })
    await load()
  }

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>使用统计</h3>
          <p className="muted">查看分析请求、Token 和成本统计。</p>
        </div>
        <div className="execution-actions">
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn" onClick={cleanup}>
            清理90天前记录
          </button>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>请求总数</h4>
          <div className="value">{stats?.total_requests ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>输入Token</h4>
          <div className="value">{stats?.total_input_tokens ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>输出Token</h4>
          <div className="value">{stats?.total_output_tokens ?? '-'}</div>
        </article>
      </section>

      <section className="card execution-list">
        <h4>最近记录</h4>
        {records.length === 0 ? (
          <p className="muted">暂无记录。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>提供方</th>
                <th>模型</th>
                <th>输入</th>
                <th>输出</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{item.provider}</td>
                  <td>{item.model_name}</td>
                  <td>{item.input_tokens}</td>
                  <td>{item.output_tokens}</td>
                  <td>{item.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
