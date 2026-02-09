'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'

type Status = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

interface Execution {
  _id: string
  symbol: string
  market: string
  status: Status
  progress: number
  updated_at: string
  created_at: string
  report_id?: string
  result?: { report_id?: string }
}

export default function ExecutionsPage() {
  const [items, setItems] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<Execution[]>('/api/executions?limit=100')
      setItems(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void advanceRunning(false)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [items])

  useEffect(() => {
    const hasRunning = items.some((item) => item.status === 'running')
    if (!hasRunning) return

    const handleBeforeUnload = () => {
      fetch('/api/executions/stop-running', {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {})
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [items])

  const advanceRunning = async (withLoading = true) => {
    if (withLoading) setLoading(true)
    try {
      const runningIds = items.filter((item) => item.status === 'running').map((item) => item._id)
      for (const id of runningIds) {
        await apiFetch(`/api/executions/${id}/tick`, { method: 'POST' })
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '推进失败')
      if (withLoading) setLoading(false)
    }
  }

  const pushStep = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}/tick`, { method: 'POST' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  const cancel = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}/cancel`, { method: 'POST' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/executions/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="执行中心"
        description="查看所有任务，手动推进或停止"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              刷新
            </Button>
            <Link href="/analysis">
              <Button variant="primary">新建任务</Button>
            </Link>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card padding={false}>
        {items.length === 0 ? (
          <EmptyState
            title="暂无任务"
            description="去现场分析页面创建一个新任务"
            action={
              <Link href="/analysis">
                <Button variant="soft">创建任务</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>任务ID</Th>
                <Th>股票</Th>
                <Th>状态</Th>
                <Th>进度</Th>
                <Th>更新时间</Th>
                <Th>操作</Th>
              </tr>
            </Thead>
            <Tbody>
              {items.map((item) => {
                const reportId = item.result?.report_id || item.report_id
                return (
                  <Tr key={item._id}>
                    <Td className="font-mono text-xs text-[var(--fg-muted)]">
                      {item._id.slice(0, 12)}
                    </Td>
                    <Td>
                      <div className="text-sm font-medium text-[var(--fg)]">{item.symbol}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{item.market}</div>
                    </Td>
                    <Td>
                      <StatusBadge status={item.status} />
                    </Td>
                    <Td>
                      <div className="w-28">
                        <ProgressBar value={item.progress} size="sm" showLabel />
                      </div>
                    </Td>
                    <Td className="text-xs text-[var(--fg-muted)]">
                      {new Date(item.updated_at).toLocaleString()}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => pushStep(item._id)}
                          disabled={item.status !== 'running' || busyId === item._id}
                        >
                          推进
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => cancel(item._id)}
                          disabled={item.status !== 'running' || busyId === item._id}
                        >
                          停止
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(item._id)}
                          disabled={busyId === item._id}
                        >
                          删除
                        </Button>
                        {reportId && (
                          <Link href={`/reports/${reportId}`}>
                            <Button variant="primary" size="sm">报告</Button>
                          </Link>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
