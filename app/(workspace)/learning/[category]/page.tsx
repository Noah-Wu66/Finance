'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface Item {
  id: string
  title: string
  category: string
  summary: string
}

export default function LearningCategoryPage() {
  const params = useParams<{ category: string }>()
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

  const category = (params.category || '').toLowerCase()
  const filtered = useMemo(
    () => items.filter((item) => item.category.toLowerCase() === category),
    [items, category]
  )

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>学习分类：{params.category}</h3>
          <p className="muted">按分类查看相关文章。</p>
        </div>
        <Link className="btn btn-soft" href="/learning">
          返回学习中心
        </Link>
      </section>

      {loading ? <div className="card report-panel">加载中...</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {filtered.length === 0 ? (
          <p className="muted">该分类暂无文章。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
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
