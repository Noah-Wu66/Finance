import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { inferMarketFromCode, normalizeMarketName } from '@/lib/market'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const keyword = (request.nextUrl.searchParams.get('query') || '').trim()
  if (!keyword) {
    return ok([], '请输入关键词')
  }

  const market = normalizeMarketName(request.nextUrl.searchParams.get('market') || undefined)

  const db = await getDb()
  const rows = await db
    .collection('stock_basic_info')
    .find({
      $or: [{ symbol: { $regex: keyword, $options: 'i' } }, { code: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }]
    })
    .limit(30)
    .toArray()

  const items = rows
    .map((item) => {
      const symbol = String(item.symbol || item.code || item.ts_code || '').slice(0, 6).toUpperCase()
      const rowMarket = normalizeMarketName((item.market as string | undefined) || inferMarketFromCode(symbol))
      return {
        symbol,
        name: String(item.name || symbol),
        market: rowMarket,
        type: 'stock'
      }
    })
    .filter((item) => item.symbol)
    .filter((item) => !market || item.market === market)

  return ok(items, '搜索成功')
}
