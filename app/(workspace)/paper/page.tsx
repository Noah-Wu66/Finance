'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

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
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>模拟交易</h3>
          <p className="muted">在网页里直接下单，账户与持仓即时更新，不依赖后台定时任务。</p>
        </div>
        <div className="execution-actions">
          <button className="btn btn-soft" onClick={load} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn btn-danger" onClick={reset}>
            重置账户
          </button>
        </div>
      </section>

      {message ? <div className="card message-ok">{message}</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}

      <section className="board-cards">
        <article className="card stat-card">
          <h4>可用资金</h4>
          <div className="value">{account ? account.cash.toLocaleString() : '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>持仓市值</h4>
          <div className="value">{account ? account.positions_value.CNY.toLocaleString() : '-'}</div>
        </article>
        <article className="card stat-card">
          <h4>账户权益</h4>
          <div className="value">{account ? account.equity.toLocaleString() : '-'}</div>
        </article>
      </section>

      <section className="card report-panel">
        <h4>快速下单</h4>
        <form className="favorite-form" onSubmit={submitOrder}>
          <input className="input mono" placeholder="股票代码" value={code} onChange={(e) => setCode(e.target.value)} />
          <select className="select" value={side} onChange={(e) => setSide(e.target.value as 'buy' | 'sell')}>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
          <input
            className="input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
          <button className="btn btn-primary" type="submit">
            提交订单
          </button>
        </form>
      </section>

      <section className="card execution-list">
        <h4>当前持仓</h4>
        {positions.length === 0 ? (
          <p className="muted">暂无持仓。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代码</th>
                <th>数量</th>
                <th>成本</th>
                <th>现价</th>
                <th>浮盈亏</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((item) => (
                <tr key={item.code}>
                  <td className="mono">{item.code}</td>
                  <td>{item.quantity}</td>
                  <td>{item.avg_cost.toFixed(2)}</td>
                  <td>{item.last_price?.toFixed(2) ?? '-'}</td>
                  <td>{item.unrealized_pnl?.toFixed(2) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card execution-list">
        <h4>最近订单</h4>
        {orders.length === 0 ? (
          <p className="muted">暂无订单。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>代码</th>
                <th>方向</th>
                <th>数量</th>
                <th>价格</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((item, idx) => (
                <tr key={`${item.code}-${item.created_at}-${idx}`}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td className="mono">{item.code}</td>
                  <td>{item.side}</td>
                  <td>{item.quantity}</td>
                  <td>{item.price.toFixed(2)}</td>
                  <td>{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
