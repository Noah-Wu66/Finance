import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { fetchAStockExtendedSnapshot } from '@/lib/mairui-data'
import { fail, ok } from '@/lib/http'

interface Payload {
  symbol?: string
  sync_realtime?: boolean
  sync_historical?: boolean
  sync_financial?: boolean
  sync_basic?: boolean
  data_source?: 'mairui'
  days?: number
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const symbol = (body.symbol || '').trim().toUpperCase()
  if (!symbol) return fail('缺少股票代码', 400)

  const core = await fetchAStockData(symbol)

  const shouldFetchExtended = body.sync_basic !== false || body.sync_financial !== false
  const extended = shouldFetchExtended
    ? await fetchAStockExtendedSnapshot(symbol)
    : null

  return ok(
    {
      symbol,
      data_source: 'mairui',
      core,
      extended,
      realtime_sync: core.realtime,
      historical_sync: core.kline,
      financial_sync: core.financial,
      basic_sync: core.profile
    },
    core.success ? '单股同步完成' : '单股同步完成（部分失败）'
  )
}
