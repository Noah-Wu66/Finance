import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { hasTushareLicence, todayYmd, tusharePost } from '@/lib/tushare-data'

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
      () => tusharePost('rt_k', { ts_code: '000001.SZ' }, ['ts_code', 'close', 'trade_time']),
      LOCAL_CACHE_ONE_MINUTE_MS
    )
    const lastTradeDate = rows.length > 0 ? today : today

    return ok(
      {
        status: 'ready',
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
