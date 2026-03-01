import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence, tusharePost, daysAgoYmd, todayYmd } from '@/lib/mairui-data'

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

const INDEX_LIST = [
  { code: '000001', codeWithMarket: '000001.SH', name: '上证指数' },
  { code: '399001', codeWithMarket: '399001.SZ', name: '深证成指' },
  { code: '399006', codeWithMarket: '399006.SZ', name: '创业板指' }
]

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function fetchIndexProxy(codeWithMarket: string, code: string, name: string): Promise<IndexItem | null> {
  try {
    const rows = await tusharePost(
      'index_daily',
      { ts_code: codeWithMarket, start_date: daysAgoYmd(10), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'close', 'open', 'high', 'low', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    )
    if (rows.length === 0) return null

    // 按日期倒序
    rows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))
    const row = rows[0]

    return {
      code,
      name,
      price: toNum(row.close),
      change: toNum(row.change),
      pct_chg: toNum(row.pct_chg),
      open: toNum(row.open),
      high: toNum(row.high),
      low: toNum(row.low),
      pre_close: toNum(row.pre_close),
      volume: toNum(row.vol),
      amount: toNum(row.amount)
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const tasks = INDEX_LIST.map((item) => fetchIndexProxy(item.codeWithMarket, item.code, item.name))
  const resultsData = await Promise.all(tasks)

  const finalResults: IndexItem[] = resultsData.map((res, i) => {
    if (res) return res
    const cfg = INDEX_LIST[i]
    return {
      code: cfg.code,
      name: cfg.name,
      price: 0,
      change: 0,
      pct_chg: 0,
      open: 0,
      high: 0,
      low: 0,
      pre_close: 0,
      volume: 0,
      amount: 0
    }
  })

  return ok(finalResults, '获取指数行情成功')
}
