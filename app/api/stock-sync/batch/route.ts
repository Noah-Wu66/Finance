import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { fetchAStockExtendedSnapshot } from '@/lib/mairui-data'
import { fail, ok } from '@/lib/http'

interface Payload {
  symbols?: string[]
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
  const symbols = (body.symbols || []).map((x) => String(x).trim().toUpperCase()).filter(Boolean)
  if (symbols.length === 0) return fail('请传入股票列表', 400)

  let successCount = 0
  let failedCount = 0
  const details: Array<Record<string, unknown>> = []

  for (const symbol of symbols) {
    const core = await fetchAStockData(symbol)
    const shouldFetchExtended = body.sync_basic !== false || body.sync_financial !== false
    const extended = shouldFetchExtended
      ? await fetchAStockExtendedSnapshot(symbol)
      : null

    if (core.success) {
      successCount += 1
    } else {
      failedCount += 1
    }

    details.push({
      symbol,
      core,
      extended
    })
  }

  return ok(
    {
      total: symbols.length,
      success_count: successCount,
      failed_count: failedCount,
      data_source: 'mairui',
      details
    },
    failedCount === 0 ? '批量同步完成' : '批量同步完成（部分失败）'
  )
}
