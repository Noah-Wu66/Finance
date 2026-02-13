import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { searchStockBasics } from '@/lib/stock-data'

interface Params {
  params: Promise<{ market: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '20')))
  if (!q) {
    return ok({ stocks: [], total: 0 }, '请输入关键词')
  }

  const all = await searchStockBasics(q, limit)
  return ok({ stocks: all, total: all.length }, '搜索成功')
}
