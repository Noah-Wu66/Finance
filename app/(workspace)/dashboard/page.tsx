'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface Summary {
  running: number
  completed: number
  failed: number
  stopped: number
  reports: number
  favorites: number
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<Summary>('/api/dashboard/summary')
      setSummary(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  return (
    <div className="container board-grid">
      <section className="card board-top">
        <div>
          <h3>今天的执行状态</h3>
          <p className="muted">你在页面里触发的任务会按步骤推进，不再依赖后台常驻服务。</p>
        </div>
        <button className="btn btn-soft" onClick={loadSummary} disabled={loading}>
          {loading ? '刷新中...' : '刷新数据'}
        </button>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>运行中</h4>
          <div className="value">{summary?.running ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>已完成</h4>
          <div className="value">{summary?.completed ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>失败</h4>
          <div className="value">{summary?.failed ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>停止/取消</h4>
          <div className="value">{summary?.stopped ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>报告总数</h4>
          <div className="value">{summary?.reports ?? '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>自选股</h4>
          <div className="value">{summary?.favorites ?? '-'}</div>
        </article>
      </section>

      <section className="card board-actions">
        <h3>快速入口</h3>
        <div className="quick-grid">
          <Link className="quick-link" href="/analysis">
            开始现场分析
          </Link>
          <Link className="quick-link" href="/executions">
            查看执行中心
          </Link>
          <Link className="quick-link" href="/reports">
            查看报告结果
          </Link>
          <Link className="quick-link" href="/favorites">
            管理自选股
          </Link>
        </div>
      </section>
    </div>
  )
}
