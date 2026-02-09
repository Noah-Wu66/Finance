'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

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
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>自选股</h3>
          <p className="muted">管理你常看的股票，后续可直接在现场分析里调用。</p>
        </div>
      </section>

      <section className="card report-panel">
        <h4>添加自选股</h4>
        <form className="favorite-form" onSubmit={add}>
          <input
            className="input mono"
            placeholder="股票代码"
            value={stockCode}
            onChange={(event) => setStockCode(event.target.value)}
          />
          <input
            className="input"
            placeholder="股票名称（可选）"
            value={stockName}
            onChange={(event) => setStockName(event.target.value)}
          />
          <select className="select" value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="A股">A股</option>
            <option value="港股">港股</option>
            <option value="美股">美股</option>
          </select>
          <button className="btn btn-primary" type="submit">
            添加
          </button>
        </form>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        {loading ? (
          <p className="muted">加载中...</p>
        ) : items.length === 0 ? (
          <p className="muted">还没有自选股。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>市场</th>
                <th>添加时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.stock_code}>
                  <td className="mono">{item.stock_code}</td>
                  <td>{item.stock_name}</td>
                  <td>{item.market}</td>
                  <td>{item.added_at ? new Date(item.added_at).toLocaleString() : '-'}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => remove(item.stock_code)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
