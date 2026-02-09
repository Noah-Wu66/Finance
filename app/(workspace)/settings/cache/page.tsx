'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface CacheStats {
  totalFiles: number
  stockDataCount: number
  newsDataCount: number
  analysisDataCount: number
}

export default function SettingsCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<CacheStats>('/api/cache/stats')
      setStats(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const clear = async () => {
    await apiFetch('/api/cache/clear', { method: 'DELETE' })
    await load()
  }

  const cleanup = async () => {
    await apiFetch('/api/cache/cleanup?days=7', { method: 'DELETE' })
    await load()
  }

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>缓存管理</h3>
          <p className="muted">现场执行模式下缓存存储在 MongoDB 集合 `app_cache`。</p>
        </div>
        <div className="execution-actions">
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn" onClick={cleanup}>
            清理7天前缓存
          </button>
          <button className="btn btn-danger" onClick={clear}>
            清空全部缓存
          </button>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>总条目</h4>
          <div className="value">{stats?.totalFiles ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>股票缓存</h4>
          <div className="value">{stats?.stockDataCount ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>新闻缓存</h4>
          <div className="value">{stats?.newsDataCount ?? '-'}</div>
        </article>
      </section>
    </div>
  )
}
