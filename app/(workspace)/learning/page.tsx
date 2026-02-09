'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface Item {
  id: string
  title: string
  category: string
  summary: string
}

export default function LearningPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<Item[]>('/api/learning/articles')
        setItems(res.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>学习中心</h3>
          <p className="muted">把原有文档整合到网页里，直接在线阅读。</p>
        </div>
      </section>

      {loading ? <div className="card report-panel">加载中...</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {items.length === 0 ? (
          <p className="muted">暂无文章。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>分类</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.category}</td>
                  <td>{item.summary}</td>
                  <td>
                    <Link className="btn btn-primary" href={`/learning/article/${item.id}`}>
                      阅读
                    </Link>
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
