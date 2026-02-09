'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface LogReadResp {
  filename: string
  lines: string[]
  stats: {
    total_lines: number
    filtered_lines: number
    error_count: number
    warning_count: number
    info_count: number
    debug_count: number
  }
}

export default function SettingsSystemLogsPage() {
  const [content, setContent] = useState<LogReadResp | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<LogReadResp>('/api/system/system-logs/read', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'operation.log',
          lines: 200,
          keyword: keyword || undefined
        })
      })
      setContent(res.data)
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
          <h3>系统日志</h3>
          <p className="muted">现场执行模式下系统日志来自数据库操作记录。</p>
        </div>
        <div className="execution-actions">
          <input className="input" placeholder="关键词过滤" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '读取中...' : '读取日志'}
          </button>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card report-panel">
        <h4>日志内容</h4>
        <pre className="raw-block">{content?.lines?.join('\n') || '暂无日志内容'}</pre>
      </section>
    </div>
  )
}
