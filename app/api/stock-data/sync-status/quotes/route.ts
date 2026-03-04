import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { daysAgoYmd, hasTushareLicence, todayYmd, tusharePost } from '@/lib/tushare-data'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  if (!hasTushareLicence()) {
    return ok(
      {
        status: 'disabled',
        total_records: null,
        last_trade_date: null,
        updated_at: null,
        source: 'tushare_direct'
      },
      '未配置 TUSHARE_TOKEN'
    )
  }

  try {
    const today = todayYmd()
    const rows = await getOrSetLocalCache(
      `sync-status:quotes:${today}`,
      () => tusharePost('daily', { ts_code: '000001.SZ', start_date: daysAgoYmd(10), end_date: today }, ['ts_code', 'trade_date', 'close']),
      LOCAL_CACHE_ONE_MINUTE_MS
    )
    const sorted = rows.sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
    const lastTradeDate = sorted.length > 0 ? String(sorted[0].trade_date || '') : null

    return ok(
      {
        status: sorted.length > 0 ? 'ready' : 'empty',
        total_records: null,
        last_trade_date: lastTradeDate,
        updated_at: new Date().toISOString(),
        source: 'tushare_direct'
      },
      '获取行情同步状态成功'
    )
  } catch (error) {
    return fail('获取行情同步状态失败', 500, error instanceof Error ? error.message : String(error))
  }
}
