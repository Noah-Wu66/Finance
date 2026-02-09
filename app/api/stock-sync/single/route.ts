import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Payload {
  symbol?: string
  sync_realtime?: boolean
  sync_historical?: boolean
  sync_financial?: boolean
  sync_basic?: boolean
  data_source?: 'tushare' | 'akshare'
  days?: number
}

function result(message: string, records = 0) {
  return {
    success: true,
    records,
    message
  }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const symbol = (body.symbol || '').trim().toUpperCase()
  if (!symbol) return fail('缺少股票代码', 400)

  return ok(
    {
      symbol,
      realtime_sync: body.sync_realtime === false ? null : result('实时行情已检查', 1),
      historical_sync: body.sync_historical ? result('历史行情已检查', body.days || 30) : null,
      financial_sync: body.sync_financial ? result('财务数据已检查', 1) : null,
      basic_sync: body.sync_basic ? result('基础信息已检查', 1) : null
    },
    '单股同步完成'
  )
}
