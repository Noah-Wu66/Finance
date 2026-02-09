'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
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
    <div className="space-y-6">
      <PageHeader
        title={detail?.title || '文章详情'}
        description={detail?.summary}
        actions={
          <Link href="/learning">
            <Button variant="soft">返回列表</Button>
          </Link>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : detail ? (
        <Card>
          <pre className="whitespace-pre-wrap font-mono text-sm bg-[var(--bg-secondary)] rounded-lg p-4 overflow-auto max-h-[600px]">
            {detail.content}
          </pre>
        </Card>
      ) : null}
    </div>
  )
}
