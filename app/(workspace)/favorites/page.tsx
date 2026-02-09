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

interface FavoriteItem {
  stock_code: string
  stock_name: string
  market: string
  added_at: string
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [stockCode, setStockCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [market, setMarket] = useState('A股')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<FavoriteItem[]>('/api/favorites')
      setItems(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      const res = await apiFetch<FavoriteItem[]>('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({
          stock_code: stockCode,
          stock_name: stockName,
          market
        })
      })
      setItems(res.data || [])
      setStockCode('')
      setStockName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  const remove = async (code: string) => {
    setError('')
    try {
      await apiFetch(`/api/favorites/${code}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="自选股" description="管理你常看的股票，后续可直接在现场分析里调用。" />

      <Card>
        <form onSubmit={add} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="股票代码"
              placeholder="股票代码"
              className="font-mono"
              value={stockCode}
              onChange={(event) => setStockCode(event.target.value)}
            />

            <Input
              label="股票名称"
              placeholder="股票名称（可选）"
              value={stockName}
              onChange={(event) => setStockName(event.target.value)}
            />

            <Select label="市场" value={market} onChange={(event) => setMarket(event.target.value)}>
              <option value="A股">A股</option>
              <option value="港股">港股</option>
              <option value="美股">美股</option>
            </Select>

            <div className="flex items-end">
              <Button variant="primary" type="submit" className="w-full">
                添加
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="还没有自选股" description="在上方添加你关注的股票" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>代码</Th>
                <Th>名称</Th>
                <Th>市场</Th>
                <Th>添加时间</Th>
                <Th>操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.stock_code}>
                  <Td className="font-mono">{item.stock_code}</Td>
                  <Td>{item.stock_name}</Td>
                  <Td>{item.market}</Td>
                  <Td>{item.added_at ? new Date(item.added_at).toLocaleString() : '-'}</Td>
                  <Td>
                    <Button variant="danger" size="sm" onClick={() => remove(item.stock_code)}>
                      删除
                    </Button>
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
