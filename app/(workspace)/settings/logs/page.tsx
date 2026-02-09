'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface LogItem {
  id: string
  action_type: string
  action: string
  success: boolean
  created_at: string
}

interface LogListResp {
  logs: LogItem[]
  total: number
  page: number
  page_size: number
}

export default function SettingsLogsPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<LogListResp>('/api/system/logs/list?page=1&page_size=100')
      setItems(res.data.logs || [])
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
          <h3>操作日志</h3>
          <p className="muted">记录你在网页里触发的操作行为，便于回溯。</p>
        </div>
        <button className="btn btn-soft" onClick={load} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {items.length === 0 ? (
          <p className="muted">暂无日志。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>动作</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.action_type}</td>
                  <td>{item.action}</td>
                  <td>{item.success ? '成功' : '失败'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
