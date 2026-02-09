'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'

interface AccountResp {
  account: {
    cash: number
    realized_pnl: number
    equity: number
    positions_value: { CNY: number }
    updated_at?: string
  }
  positions: Array<{
    code: string
    quantity: number
    avg_cost: number
    last_price: number
    market_value: number
    unrealized_pnl: number
  }>
}

interface OrderItem {
  code: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  amount: number
  status: string
  created_at: string
}

export default function PaperPage() {
  const [account, setAccount] = useState<AccountResp['account'] | null>(null)
  const [positions, setPositions] = useState<AccountResp['positions']>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [code, setCode] = useState('')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState(100)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [accountRes, orderRes] = await Promise.all([
        apiFetch<AccountResp>('/api/paper/account'),
        apiFetch<{ items: OrderItem[] }>('/api/paper/orders?limit=50')
      ])
      setAccount(accountRes.data.account)
      setPositions(accountRes.data.positions || [])
      setOrders(orderRes.data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await apiFetch('/api/paper/order', {
        method: 'POST',
        body: JSON.stringify({ code, side, quantity })
      })
      setMessage('下单成功')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '下单失败')
    }
  }

  const reset = async () => {
    setMessage('')
    setError('')
    try {
      await apiFetch('/api/paper/reset?confirm=true', { method: 'POST' })
      setMessage('账户已重置')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="模拟交易"
        description="在网页里直接下单，账户与持仓即时更新，不依赖后台定时任务。"
        actions={
          <>
            <Button variant="soft" onClick={load} disabled={loading}>
              {loading ? '刷新中...' : '刷新'}
            </Button>
            <Button variant="danger" onClick={reset}>
              重置账户
            </Button>
          </>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">可用资金</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fg)] tabular-nums">
            {account ? account.cash.toLocaleString() : '-'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">持仓市值</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fg)] tabular-nums">
            {account ? account.positions_value.CNY.toLocaleString() : '-'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">账户权益</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fg)] tabular-nums">
            {account ? account.equity.toLocaleString() : '-'}
          </p>
        </Card>
      </div>

      {/* 快速下单 */}
      <Card>
        <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">快速下单</h4>
        <form onSubmit={submitOrder} className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
          <Input
            label="股票代码"
            placeholder="股票代码"
            className="font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Select
            label="方向"
            value={side}
            onChange={(e) => setSide(e.target.value as 'buy' | 'sell')}
          >
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </Select>
          <Input
            label="数量"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
          <Button variant="primary" type="submit">
            提交订单
          </Button>
        </form>
      </Card>

      {/* 当前持仓 */}
      <Card padding={false}>
        <h4 className="text-sm font-semibold text-[var(--fg)] px-5 pt-5 pb-3">当前持仓</h4>
        {positions.length === 0 ? (
          <EmptyState description="暂无持仓。" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>代码</Th>
                <Th>数量</Th>
                <Th>成本</Th>
                <Th>现价</Th>
                <Th>浮盈亏</Th>
              </Tr>
            </Thead>
            <Tbody>
              {positions.map((item) => (
                <Tr key={item.code}>
                  <Td className="font-mono">{item.code}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{item.avg_cost.toFixed(2)}</Td>
                  <Td>{item.last_price?.toFixed(2) ?? '-'}</Td>
                  <Td>{item.unrealized_pnl?.toFixed(2) ?? '-'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* 最近订单 */}
      <Card padding={false}>
        <h4 className="text-sm font-semibold text-[var(--fg)] px-5 pt-5 pb-3">最近订单</h4>
        {orders.length === 0 ? (
          <EmptyState description="暂无订单。" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>时间</Th>
                <Th>代码</Th>
                <Th>方向</Th>
                <Th>数量</Th>
                <Th>价格</Th>
                <Th>金额</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orders.map((item, idx) => (
                <Tr key={`${item.code}-${item.created_at}-${idx}`}>
                  <Td>{new Date(item.created_at).toLocaleString()}</Td>
                  <Td className="font-mono">{item.code}</Td>
                  <Td>{item.side}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{item.price.toFixed(2)}</Td>
                  <Td>{item.amount.toFixed(2)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
