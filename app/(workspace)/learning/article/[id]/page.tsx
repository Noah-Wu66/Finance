'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

interface Detail {
  id: string
  title: string
  category: string
  summary: string
  content: string
}

export default function LearningArticlePage() {
  const params = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch<Detail>(`/api/learning/article/${params.id}`)
        setDetail(res.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [params.id])

  return (
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>{detail?.title || '文章详情'}</h3>
          <p className="muted">{detail?.summary || '正在加载...'}</p>
        </div>
        <Link className="btn btn-soft" href="/learning">
          返回列表
        </Link>
      </section>

      {loading ? <div className="card report-panel">正在加载文章...</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      {detail ? (
        <section className="card report-panel">
          <pre className="raw-block">{detail.content}</pre>
        </section>
      ) : null}
    </div>
  )
}
