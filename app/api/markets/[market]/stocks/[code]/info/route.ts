import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { fetchAStockProfileSummary } from '@/lib/mairui-data'
import { getStockBasicByCode } from '@/lib/stock-data'

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { code } = await params
  let info = await getStockBasicByCode(code)

  if (!info) {
    await fetchAStockProfileSummary(code)
    info = await getStockBasicByCode(code)
  }

  if (!info) return fail('股票不存在', 404)

  return ok(info, '获取股票基础信息成功')
}
