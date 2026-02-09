'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface NotificationItem {
  id: string
  title: string
  content?: string
  type: 'analysis' | 'alert' | 'system'
  status: 'unread' | 'read'
  created_at: string
  link?: string
  source?: string
}

interface NotificationResponse {
  items: NotificationItem[]
  total: number
  page: number
  page_size: number
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<NotificationResponse>('/api/notifications?status=all&page=1&page_size=100')
      setItems(res.data.items || [])
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
    const timer = window.setInterval(() => {
      void load()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
    await load()
  }

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read_all', { method: 'POST' })
    await load()
  }

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>通知中心</h3>
          <p className="muted">分析完成、失败、停止等事件会在这里实时出现（轮询刷新）。</p>
        </div>
        <div className="execution-actions">
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn btn-primary" onClick={markAllRead}>
            全部标记已读
          </button>
        </div>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {items.length === 0 ? (
          <p className="muted">暂无通知。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>状态</th>
                <th>标题</th>
                <th>内容</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`status ${item.status === 'unread' ? 'status-running' : 'status-completed'}`}>
                      {item.status === 'unread' ? '未读' : '已读'}
                    </span>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    <div>{item.content || '-'}</div>
                    {item.link ? (
                      <a href={item.link} className="mono" style={{ color: '#0f766e' }}>
                        {item.link}
                      </a>
                    ) : null}
                  </td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-soft" onClick={() => markRead(item.id)} disabled={item.status === 'read'}>
                      标记已读
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
