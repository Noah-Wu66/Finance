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

interface SyncStatus {
  status: string
  total: number
  inserted: number
  updated: number
  errors: number
  message?: string
  finished_at?: string
}

interface SyncHistoryResp {
  records: SyncStatus[]
  total: number
  page: number
  page_size: number
}

export default function SettingsSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [history, setHistory] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, h] = await Promise.all([
        apiFetch<SyncStatus>('/api/sync/multi-source/status'),
        apiFetch<SyncHistoryResp>('/api/sync/multi-source/history?page=1&page_size=20')
      ])
      setStatus(s.data)
      setHistory(h.data.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const runSync = async () => {
    setRunning(true)
    setError('')
    try {
      await apiFetch('/api/sync/multi-source/stock_basics/run?force=true', {
        method: 'POST'
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="多数据源同步"
        description="已改为页面手动触发，点击按钮后立即执行。"
        actions={
          <>
            <Button variant="primary" onClick={runSync} disabled={running}>
              {running ? '同步中...' : '立即同步'}
            </Button>
            <Button variant="soft" onClick={load} disabled={loading}>
              {loading ? '刷新中...' : '刷新'}
            </Button>
          </>
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
              <p className="text-xs text-[var(--fg-muted)]">当前状态</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {status?.status || '-'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--fg-muted)]">总数</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {status?.total ?? '-'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--fg-muted)]">错误数</p>
              <p className="text-2xl font-semibold text-[var(--fg)] mt-1">
                {status?.errors ?? '-'}
              </p>
            </Card>
          </div>

          <Card padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h4 className="text-sm font-semibold text-[var(--fg)] m-0">同步历史</h4>
            </div>
            {history.length === 0 ? (
              <EmptyState description="暂无历史。" />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>状态</Th>
                    <Th>总数</Th>
                    <Th>新增</Th>
                    <Th>更新</Th>
                    <Th>错误</Th>
                    <Th>完成时间</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {history.map((item, idx) => (
                    <Tr key={`${item.finished_at || item.message || idx}-${idx}`}>
                      <Td>{item.status}</Td>
                      <Td>{item.total}</Td>
                      <Td>{item.inserted}</Td>
                      <Td>{item.updated}</Td>
                      <Td>{item.errors}</Td>
                      <Td>{item.finished_at ? new Date(item.finished_at).toLocaleString() : '-'}</Td>
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
