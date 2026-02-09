'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'

interface UsageStats {
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
}

interface UsageRecord {
  id: string
  timestamp: string
  provider: string
  model_name: string
  input_tokens: number
  output_tokens: number
  cost: number
}

export default function SettingsUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, r] = await Promise.all([
        apiFetch<UsageStats>('/api/usage/statistics'),
        apiFetch<{ records: UsageRecord[] }>('/api/usage/records?limit=100')
      ])
      setStats(s.data)
      setRecords(r.data.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const cleanup = async () => {
    await apiFetch('/api/usage/records/old?days=90', { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="使用统计"
        description="查看分析请求、Token 和成本统计"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading && <Spinner size="sm" />}
              刷新
            </Button>
            <Button variant="ghost" onClick={cleanup}>
              清理90天前记录
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--fg-muted)] m-0">请求总数</p>
          <p className="text-2xl font-semibold mt-1 m-0 tabular-nums text-[var(--fg)]">
            {stats?.total_requests ?? '-'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--fg-muted)] m-0">输入 Token</p>
          <p className="text-2xl font-semibold mt-1 m-0 tabular-nums text-[var(--fg)]">
            {stats?.total_input_tokens?.toLocaleString() ?? '-'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--fg-muted)] m-0">输出 Token</p>
          <p className="text-2xl font-semibold mt-1 m-0 tabular-nums text-[var(--fg)]">
            {stats?.total_output_tokens?.toLocaleString() ?? '-'}
          </p>
        </Card>
      </div>

      {/* Records */}
      <Card padding={false}>
        {records.length === 0 ? (
          <EmptyState title="暂无记录" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>时间</Th>
                <Th>提供方</Th>
                <Th>模型</Th>
                <Th>输入</Th>
                <Th>输出</Th>
                <Th>成本</Th>
              </tr>
            </Thead>
            <Tbody>
              {records.map((item) => (
                <Tr key={item.id}>
                  <Td className="text-xs text-[var(--fg-muted)]">{new Date(item.timestamp).toLocaleString()}</Td>
                  <Td>{item.provider}</Td>
                  <Td className="font-mono text-xs">{item.model_name}</Td>
                  <Td className="tabular-nums">{item.input_tokens.toLocaleString()}</Td>
                  <Td className="tabular-nums">{item.output_tokens.toLocaleString()}</Td>
                  <Td className="tabular-nums">{item.cost}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
