import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface RunPayload {
  conditions?: Record<string, any>
  limit?: number
  offset?: number
}

function inRange(value: number, min?: number, max?: number) {
  if (Number.isFinite(min) && value < Number(min)) return false
  if (Number.isFinite(max) && value > Number(max)) return false
  return true
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as RunPayload
  const conditions = body.conditions || {}
  const limit = Math.min(200, Math.max(1, Number(body.limit || 50)))
  const offset = Math.max(0, Number(body.offset || 0))

  const db = await getDb()

  const basicRows = await db
    .collection('stock_basic_info')
    .find({})
    .project({ symbol: 1, code: 1, industry: 1 })
    .limit(800)
    .toArray()

  const items = [] as Array<{
    code: string
    close: number
    pct_chg: number
    amount: number
    ma20: number
    rsi14: number
    kdj_k: number
    kdj_d: number
    kdj_j: number
    dif: number
    dea: number
    macd_hist: number
  }>

  for (const basic of basicRows) {
    const code = String(basic.symbol || '').slice(0, 6)
    if (!code) continue

    const [quote, financial] = await Promise.all([
      db
        .collection('stock_quotes')
        .find({ symbol: code })
        .sort({ trade_date: -1 })
        .limit(1)
        .next(),
      db
        .collection('financial_data')
        .find({ symbol: code })
        .sort({ report_date: -1, updated_at: -1 })
        .limit(1)
        .next()
    ])

    const close = Number(quote?.close ?? 0)
    const pctChg = Number(quote?.pct_chg ?? 0)
    const amount = Number(quote?.amount ?? 0)
    const pe = Number(financial?.pe ?? 0)
    const pb = Number(financial?.pb ?? 0)

    if (conditions.close && !inRange(close, conditions.close.min, conditions.close.max)) continue
    if (conditions.pct_chg && !inRange(pctChg, conditions.pct_chg.min, conditions.pct_chg.max)) continue
    if (conditions.pe && !inRange(pe, conditions.pe.min, conditions.pe.max)) continue
    if (conditions.pb && !inRange(pb, conditions.pb.min, conditions.pb.max)) continue
    if (conditions.industry) {
      const industries = Array.isArray(conditions.industry) ? conditions.industry : [conditions.industry]
      if (!industries.includes(String(basic.industry || ''))) {
        continue
      }
    }

    items.push({
      code,
      close,
      pct_chg: pctChg,
      amount,
      ma20: Number(quote?.ma20 ?? 0),
      rsi14: Number(quote?.rsi14 ?? 0),
      kdj_k: Number(quote?.kdj_k ?? 0),
      kdj_d: Number(quote?.kdj_d ?? 0),
      kdj_j: Number(quote?.kdj_j ?? 0),
      dif: Number(quote?.dif ?? 0),
      dea: Number(quote?.dea ?? 0),
      macd_hist: Number(quote?.macd_hist ?? 0)
    })
  }

  const sliced = items.slice(offset, offset + limit)

  return ok(
    {
      total: items.length,
      items: sliced
    },
    '筛选完成'
  )
}
