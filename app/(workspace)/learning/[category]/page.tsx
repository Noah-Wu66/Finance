'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
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
    <div className="space-y-6">
      <PageHeader
        title={`学习分类：${params.category}`}
        description="按分类查看相关文章。"
        actions={
          <Link href="/learning">
            <Button variant="soft">返回学习中心</Button>
          </Link>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : filtered.length === 0 ? (
        <EmptyState title="该分类暂无文章" />
      ) : (
        <Card padding={false}>
          <Table>
            <Thead>
              <Tr>
                <Th>标题</Th>
                <Th>摘要</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.title}</Td>
                  <Td>{item.summary}</Td>
                  <Td>
                    <Link href={`/learning/article/${item.id}`}>
                      <Button variant="primary" size="sm">
                        阅读
                      </Button>
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
