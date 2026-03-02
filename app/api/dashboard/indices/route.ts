import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface IndexItem {
  code: string
  name: string
  price: number
  change: number
  pct_chg: number
  open: number
  high: number
  low: number
  pre_close: number
  volume: number
  amount: number
}

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const db = await getDb()
    const rows = await db.collection('index_daily')
      .find({})
      .sort({ trade_date: -1, updated_at: -1, _id: -1 })
      .limit(500)
      .toArray()

    const latestByCode = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
      const code = String(row.index_code || '').trim()
      if (!code || latestByCode.has(code)) continue
      latestByCode.set(code, row as Record<string, unknown>)
    }

    const items: IndexItem[] = Array.from(latestByCode.entries())
      .map(([code, row]) => ({
        code,
        name: String(row.index_name || row.proxy_name || code),
        price: toNum(row.close),
        change: toNum(row.change),
        pct_chg: toNum(row.pct_chg),
        open: toNum(row.open),
        high: toNum(row.high),
        low: toNum(row.low),
        pre_close: toNum(row.pre_close),
        volume: toNum(row.volume),
        amount: toNum(row.amount)
      }))
      .slice(0, 4)

    return ok(items, items.length > 0 ? '获取指数行情成功' : '暂无指数行情数据')
  } catch (error) {
    return fail('获取指数行情失败', 500, error instanceof Error ? error.message : String(error))
  }
}
