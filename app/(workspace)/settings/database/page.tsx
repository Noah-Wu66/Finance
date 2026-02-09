'use client'

import { useEffect, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { apiFetch } from '@/lib/client-api'

interface DbStatus {
  mongodb: {
    connected: boolean
    host: string
    port: number
    database: string
  }
  redis: {
    connected: boolean
    error?: string
  }
}

interface DbStats {
  total_collections: number
  total_documents: number
  collections: Array<{ name: string; documents: number }>
}

export default function SettingsDatabasePage() {
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, t] = await Promise.all([
        apiFetch<DbStatus>('/api/system/database/status'),
        apiFetch<DbStats>('/api/system/database/stats')
      ])
      setStatus(s.data)
      setStats(t.data)
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
    <div className="space-y-6">
      <PageHeader
        title="数据库管理"
        description="查看 MongoDB 当前状态与集合统计。"
        actions={
          <Button variant="soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading && !status ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-[var(--fg-muted)]">MongoDB</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {status?.mongodb.connected ? '正常' : '异常'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--fg-muted)]">集合总数</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {stats?.total_collections ?? '-'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--fg-muted)]">文档总数</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {stats?.total_documents ?? '-'}
              </p>
            </Card>
          </div>

          <Card padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h4 className="text-sm font-semibold text-[var(--fg)] m-0">集合明细</h4>
            </div>
            {!stats || stats.collections.length === 0 ? (
              <EmptyState description="暂无数据。" />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>集合名</Th>
                    <Th>文档数</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {stats.collections.map((item) => (
                    <Tr key={item.name}>
                      <Td>{item.name}</Td>
                      <Td>{item.documents}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
