import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getOrSetLocalCache } from '@/lib/local-data-cache'
import { daysAgoYmd, todayYmd, tusharePost } from '@/lib/tushare-data'
import { toNum } from '@/lib/utils'

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

const DASHBOARD_INDEXES: Array<{ code: string; name: string; indexTsCode: string }> = [
  { code: '000300', name: '沪深300', indexTsCode: '000300.SH' },
  { code: '000016', name: '上证50',  indexTsCode: '000016.SH' },
  { code: '000905', name: '中证500', indexTsCode: '000905.SH' },
  { code: '399006', name: '创业板指', indexTsCode: '399006.SZ' }
]

const INDEX_FIELDS = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']

async function fetchLatestIndexRow(indexTsCode: string): Promise<Record<string, unknown> | null> {
  const today = todayYmd()
  const rows = await tusharePost(
    'index_daily',
    { ts_code: indexTsCode, start_date: daysAgoYmd(10), end_date: today },
    INDEX_FIELDS
  )
  if (rows.length === 0) return null
  return rows.sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))[0]
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const rows = await Promise.all(
      DASHBOARD_INDEXES.map((index) =>
        getOrSetLocalCache(`dashboard-index:${index.indexTsCode}`, () => fetchLatestIndexRow(index.indexTsCode)).catch(() => null)
      )
    )

    const items: IndexItem[] = DASHBOARD_INDEXES.map((index, idx) => {
      const row = (rows[idx] || {}) as Record<string, unknown>
      return {
        code: index.code,
        name: index.name,
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
    })

    return ok(items, rows.some((row) => Boolean(row)) ? '获取指数行情成功' : '暂无指数行情数据')
  } catch (error) {
    return fail('获取指数行情失败', 500, error instanceof Error ? error.message : String(error))
  }
}
