'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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
    <div className="space-y-6">
      <PageHeader
        title="学习中心"
        description="把原有文档整合到网页里，直接在线阅读。"
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : items.length === 0 ? (
        <EmptyState title="暂无文章" />
      ) : (
        <Card padding={false}>
          <Table>
            <Thead>
              <Tr>
                <Th>标题</Th>
                <Th>分类</Th>
                <Th>摘要</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.title}</Td>
                  <Td>{item.category}</Td>
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
