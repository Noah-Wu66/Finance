import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { daysAgoYmd, toTsCode, todayYmd, tusharePost } from '@/lib/tushare-data'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { code, market } = await params

  const startDate = request.nextUrl.searchParams.get('start_date') || undefined
  const endDate = request.nextUrl.searchParams.get('end_date') || undefined
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '100')))

  try {
    const tsCode = toTsCode(code.toUpperCase())
    const rows = await getOrSetLocalCache(
      `market-daily:${code.toUpperCase()}:${startDate || ''}:${endDate || ''}:${limit}`,
      () => tusharePost(
        'daily',
        {
          ts_code: tsCode,
          start_date: startDate || daysAgoYmd(limit + 20),
          end_date: endDate || todayYmd()
        },
        ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
      ),
      LOCAL_CACHE_ONE_MINUTE_MS
    )

    const quotes = rows
      .sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
      .slice(0, limit)
      .map((row) => ({
        trade_date: String(row.trade_date || ''),
        open: toNum(row.open),
        high: toNum(row.high),
        low: toNum(row.low),
        close: toNum(row.close),
        volume: toNum(row.vol),
        amount: toNum(row.amount)
      }))

    return ok(
      {
        code: code.toUpperCase(),
        market: market.toUpperCase(),
        quotes,
        total: quotes.length
      },
      '获取日线成功'
    )
  } catch (error) {
    return fail('获取日线失败', 500, error instanceof Error ? error.message : String(error))
  }
}
