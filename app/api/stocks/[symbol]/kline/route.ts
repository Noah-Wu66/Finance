import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { daysAgoYmd, hasTushareLicence, toTsCode, tusharePost } from '@/lib/tushare-data'
import { toNum } from '@/lib/utils'

function futureYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

interface Params {
  params: Promise<{ symbol: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  if (!hasTushareLicence()) {
    return fail('未配置 TUSHARE_TOKEN', 503)
  }

  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.toUpperCase()
  const period = (request.nextUrl.searchParams.get('period') || 'day') as 'day' | 'week' | 'month' | '5m' | '15m' | '30m' | '60m'
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '120')))
  const adj = (request.nextUrl.searchParams.get('adj') || 'qfq') as 'none' | 'qfq' | 'hfq'

  try {
    const tsCode = toTsCode(symbol)
    const fields = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount']
    const apiName = adj === 'none' ? 'daily' : 'daily_adj'
    const rows = await getOrSetLocalCache(
      `kline:${symbol}:${period}:${adj}:${limit}`,
      () => tusharePost(
        apiName,
        {
          ts_code: tsCode,
          start_date: daysAgoYmd(limit + 20),
          end_date: futureYmd(3),
          ...(adj === 'none' ? {} : { adj })
        },
        fields
      ),
      LOCAL_CACHE_ONE_MINUTE_MS
    )

    const items = rows
      .sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
      .slice(0, limit)
      .map((row) => ({
        time: String(row.trade_date || ''),
        open: toNum(row.open),
        high: toNum(row.high),
        low: toNum(row.low),
        close: toNum(row.close),
        volume: toNum(row.vol),
        amount: toNum(row.amount)
      }))

    return ok(
      {
        symbol,
        code: symbol,
        period,
        limit,
        adj,
        source: 'tushare_direct',
        items
      },
      '获取K线成功'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[kline] failed for ${symbol}:`, errorMessage)
    return ok(
      {
        symbol,
        code: symbol,
        period,
        limit,
        adj,
        source: 'tushare_direct',
        items: []
      },
      '获取K线成功（当前暂无数据）'
    )
  }
}

