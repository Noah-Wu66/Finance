'use client'

import { FormEvent, useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

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
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>股票筛选</h3>
          <p className="muted">使用本地数据快速筛选目标股票，筛完后可直接去现场分析。</p>
        </div>
      </section>

      <section className="card report-panel">
        <form className="favorite-form" onSubmit={run}>
          <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">全部行业</option>
            {industryList.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="最低价格"
            value={closeMin}
            onChange={(e) => setCloseMin(e.target.value)}
          />
          <input
            className="input"
            placeholder="最高价格"
            value={closeMax}
            onChange={(e) => setCloseMax(e.target.value)}
          />
          <input className="input" placeholder="PE上限" value={peMax} onChange={(e) => setPeMax(e.target.value)} />

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '筛选中...' : '开始筛选'}
          </button>
        </form>
      </section>

      {error ? <div className="card board-error">{error}</div> : null}

      <section className="card execution-list">
        <p className="muted">结果总数：{total}</p>
        {items.length === 0 ? (
          <p className="muted">暂无结果。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代码</th>
                <th>最新价</th>
                <th>涨跌幅</th>
                <th>成交额</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.code}>
                  <td className="mono">{item.code}</td>
                  <td>{item.close?.toFixed(2) ?? '-'}</td>
                  <td>{item.pct_chg?.toFixed(2) ?? '-'}%</td>
                  <td>{item.amount?.toLocaleString() ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
