'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  Alert,
  Spinner,
  EmptyState,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@/components/ui'

interface ScreeningItem {
  code: string
  close?: number
  pct_chg?: number
  amount?: number
  pe?: number
  pb?: number
}

interface ScreeningResp {
  total: number
  items: ScreeningItem[]
}

export default function ScreeningPage() {
  const [industryList, setIndustryList] = useState<Array<{ value: string; label: string }>>([])
  const [industry, setIndustry] = useState('')
  const [closeMin, setCloseMin] = useState('')
  const [closeMax, setCloseMax] = useState('')
  const [peMax, setPeMax] = useState('')
  const [items, setItems] = useState<ScreeningItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadIndustries = async () => {
    try {
      const res = await apiFetch<{ industries: Array<{ value: string; label: string }> }>('/api/screening/industries')
      setIndustryList(res.data.industries || [])
    } catch {
      setIndustryList([])
    }
  }

  useEffect(() => {
    void loadIndustries()
  }, [])

  const run = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        conditions: {
          ...(closeMin || closeMax
            ? {
                close: {
                  min: closeMin ? Number(closeMin) : undefined,
                  max: closeMax ? Number(closeMax) : undefined
                }
              }
            : {}),
          ...(peMax
            ? {
                pe: {
                  max: Number(peMax)
                }
              }
            : {}),
          ...(industry ? { industry } : {})
        },
        limit: 120,
        offset: 0
      }

      const res = await apiFetch<ScreeningResp>('/api/screening/run', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '筛选失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="股票筛选" description="使用本地数据快速筛选目标股票，筛完后可直接去现场分析。" />

      <Card>
        <form onSubmit={run} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select label="行业" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">全部行业</option>
              {industryList.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>

            <Input
              label="最低价格"
              placeholder="最低价格"
              value={closeMin}
              onChange={(e) => setCloseMin(e.target.value)}
            />

            <Input
              label="最高价格"
              placeholder="最高价格"
              value={closeMax}
              onChange={(e) => setCloseMax(e.target.value)}
            />

            <Input
              label="PE上限"
              placeholder="PE上限"
              value={peMax}
              onChange={(e) => setPeMax(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading ? '筛选中...' : '开始筛选'}
            </Button>
            {total > 0 && (
              <span className="text-sm text-[var(--fg-muted)]">共 {total} 条结果</span>
            )}
          </div>
        </form>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card padding={false}>
        {items.length === 0 ? (
          <EmptyState title="暂无结果" description="请设置筛选条件后点击开始筛选" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>代码</Th>
                <Th>最新价</Th>
                <Th>涨跌幅</Th>
                <Th>成交额</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.code}>
                  <Td className="font-mono">{item.code}</Td>
                  <Td>{item.close?.toFixed(2) ?? '-'}</Td>
                  <Td>{item.pct_chg?.toFixed(2) ?? '-'}%</Td>
                  <Td>{item.amount?.toLocaleString() ?? '-'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
