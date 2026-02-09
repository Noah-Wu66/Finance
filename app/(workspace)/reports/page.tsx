'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import {
  Button,
  Card,
  PageHeader,
  Alert,
  Spinner,
  EmptyState,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@/components/ui'

interface ReportItem {
  _id: string
  analysis_id: string
  stock_symbol: string
  stock_name?: string
  market_type?: string
  summary?: string
  confidence_score?: number
  risk_level?: string
  created_at: string
}

interface ReportResponse {
  items: ReportItem[]
  total: number
  page: number
  page_size: number
}

export default function ReportsPage() {
  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<ReportResponse>('/api/reports?page=1&page_size=100')
      setItems(res.data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/reports/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="报告中心"
        description="这里展示你在页面现场执行后生成的全部分析报告。"
        actions={
          <Button variant="soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新列表'}
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="暂无报告"
            description="还没有生成任何分析报告。"
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>股票</Th>
                <Th>摘要</Th>
                <Th>置信度</Th>
                <Th>风险</Th>
                <Th>生成时间</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item._id}>
                  <Td>
                    <div className="font-mono text-[var(--fg)] font-medium">
                      {item.stock_symbol}
                    </div>
                    <div className="text-xs text-[var(--fg-muted)] mt-0.5">
                      {item.stock_name || '-'} · {item.market_type || '-'}
                    </div>
                  </Td>
                  <Td className="max-w-xs truncate">{item.summary || '-'}</Td>
                  <Td>{item.confidence_score ?? '-'}</Td>
                  <Td>{item.risk_level ?? '-'}</Td>
                  <Td className="whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link href={`/reports/${item._id}`}>
                        <Button variant="primary" size="sm">
                          查看详情
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => remove(item._id)}
                        disabled={busyId === item._id}
                      >
                        删除
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
