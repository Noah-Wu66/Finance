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
  result?: {
    report_id?: string
    summary?: string
    recommendation?: string
    confidence_score?: number
    risk_level?: string
  }
}

export default function ExecutionsPage() {
  const [items, setItems] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState('')

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

  const removeReport = async (reportId: string) => {
    setBusyId(reportId)
    try {
      await apiFetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="执行中心"
        description="管理分析任务，查看执行结果与报告"
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
            description="去量化分析页面创建一个新任务"
            action={
              <Link href="/analysis">
                <Button variant="soft">创建任务</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => {
              const reportId = item.result?.report_id || item.report_id
              const hasReport = item.status === 'completed' && item.result
              const isExpanded = expandedId === item._id

              return (
                <div key={item._id}>
                  {/* 主行 */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    {/* 股票信息 */}
                    <div className="w-24 shrink-0">
                      <div className="text-sm font-medium text-[var(--fg)]">{item.symbol}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{item.market}</div>
                    </div>

                    {/* 状态 */}
                    <div className="w-20 shrink-0">
                      <StatusBadge status={item.status} />
                    </div>

                    {/* 进度 */}
                    <div className="w-28 shrink-0">
                      <ProgressBar value={item.progress} size="sm" showLabel />
                    </div>

                    {/* 报告摘要（已完成的任务） */}
                    <div className="flex-1 min-w-0">
                      {hasReport && item.result?.summary ? (
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-[var(--fg-secondary)] truncate m-0 flex-1">
                            {item.result.summary}
                          </p>
                          {item.result.confidence_score != null && (
                            <span className="text-xs text-[var(--fg-muted)] whitespace-nowrap">
                              置信 {item.result.confidence_score}%
                            </span>
                          )}
                          {item.result.risk_level && (
                            <span className="text-xs text-[var(--fg-muted)] whitespace-nowrap">
                              风险 {item.result.risk_level}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--fg-muted)]">
                          {new Date(item.updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === 'running' && (
                        <>
                          <Button
                            variant="soft"
                            size="sm"
                            onClick={() => pushStep(item._id)}
                            disabled={busyId === item._id}
                          >
                            推进
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => cancel(item._id)}
                            disabled={busyId === item._id}
                          >
                            停止
                          </Button>
                        </>
                      )}
                      {hasReport && (
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? '' : item._id)}
                        >
                          {isExpanded ? '收起' : '详情'}
                        </Button>
                      )}
                      {reportId && (
                        <Link href={`/reports/${reportId}`}>
                          <Button variant="primary" size="sm">报告</Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(item._id)}
                        disabled={busyId === item._id}
                      >
                        删除
                      </Button>
                    </div>
                  </div>

                  {/* 展开的报告详情 */}
                  {isExpanded && hasReport && (
                    <div className="px-4 pb-4">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-sm text-[var(--fg-secondary)] leading-relaxed m-0">
                              {item.result?.summary}
                            </p>
                            <p className="text-sm text-[var(--fg-secondary)] leading-relaxed m-0">
                              {item.result?.recommendation}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-[var(--fg-muted)]">
                            {item.result?.confidence_score != null && (
                              <span>置信度：<span className="font-mono font-medium text-[var(--fg-secondary)]">{item.result.confidence_score}%</span></span>
                            )}
                            {item.result?.risk_level && (
                              <span>风险：<span className="font-mono font-medium text-[var(--fg-secondary)]">{item.result.risk_level}</span></span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                          {reportId && (
                            <Link href={`/reports/${reportId}`}>
                              <Button variant="primary" size="sm">查看完整报告</Button>
                            </Link>
                          )}
                          {reportId && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => removeReport(reportId)}
                              disabled={busyId === reportId}
                            >
                              删除报告
                            </Button>
                          )}
                          <span className="text-xs text-[var(--fg-muted)] ml-auto">
                            {new Date(item.updated_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
