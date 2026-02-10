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

interface LogItem {
  id: string
  action_type: string
  action: string
  success: boolean
  created_at: string
}

interface LogListResp {
  logs: LogItem[]
  total: number
  page: number
  page_size: number
}

export default function SettingsLogsPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<LogListResp>('/api/system/logs/list?page=1&page_size=100')
      setItems(res.data.logs || [])
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
        title="操作日志"
        description="记录你在网页里触发的操作行为，便于回溯"
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading && <Spinner size="sm" />}
            刷新
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card padding={false}>
        {items.length === 0 ? (
          <EmptyState title="暂无日志" />
        ) : (
          <>
            <div className="sm:hidden divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div key={item.id} className="p-3.5 space-y-2">
                  <div className="text-xs text-[var(--fg-muted)]">{new Date(item.created_at).toLocaleString()}</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--fg-secondary)]">{item.action_type}</span>
                    <span className={item.success ? 'text-xs text-success-600 dark:text-success-400' : 'text-xs text-danger-600 dark:text-danger-400'}>
                      {item.success ? '成功' : '失败'}
                    </span>
                  </div>
                  <p className="m-0 text-sm text-[var(--fg)] break-all">{item.action}</p>
                </div>
              ))}
            </div>

            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <tr>
                    <Th>时间</Th>
                    <Th>类型</Th>
                    <Th>动作</Th>
                    <Th>结果</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {items.map((item) => (
                    <Tr key={item.id}>
                      <Td className="text-xs text-[var(--fg-muted)]">{new Date(item.created_at).toLocaleString()}</Td>
                      <Td>{item.action_type}</Td>
                      <Td>{item.action}</Td>
                      <Td>
                        <span className={item.success ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}>
                          {item.success ? '成功' : '失败'}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
