import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getOrSetLocalCache } from '@/lib/local-data-cache'
import { inferMarketFromCode, normalizeMarketName } from '@/lib/market'
import { fetchAStockList } from '@/lib/tushare-data'

async function searchLocal(keyword: string, limit = 30) {
  const db = await getDb()
  return db
    .collection('stock_basic_info')
    .find({
      $or: [
        { symbol: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } }
      ]
    })
    .limit(limit)
    .toArray()
}

function mapRows(rows: Record<string, unknown>[], market?: string) {
  return rows
    .map((item) => {
      const symbol = String(item.symbol || '').slice(0, 6).toUpperCase()
      const rowMarket = normalizeMarketName(
        (item.market as string | undefined) || inferMarketFromCode(symbol)
      )
      return {
        symbol,
        name: String(item.name || symbol),
        market: rowMarket,
        type: 'stock'
      }
    })
    .filter((item) => item.symbol)
    .filter((item) => !market || item.market === market)
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const keyword = (request.nextUrl.searchParams.get('query') || '').trim()
  if (!keyword) {
    return ok([], '请输入关键词')
  }

  const market = normalizeMarketName(
    request.nextUrl.searchParams.get('market') || undefined
  )

  // 1. 先查本地
  let rows = await searchLocal(keyword)
  if (rows.length > 0) {
    return ok(mapRows(rows, market), '搜索成功')
  }

  // 2. 本地无结果 → 检查数据库有没有数据，没有的话从 tushare 拉取
  const db = await getDb()
  const count = await db.collection('stock_basic_info').estimatedDocumentCount()
  if (count === 0) {
    await getOrSetLocalCache('stock-list:all', () => fetchAStockList())
    // 拉完后再查一次
    rows = await searchLocal(keyword)
  }

  return ok(mapRows(rows, market), '搜索成功')
}
