import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getStockBasicByCode } from '@/lib/stock-data'

interface Params {
  params: { market: string; code: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const info = await getStockBasicByCode(params.code)
  if (!info) {
    return fail('股票不存在', 404)
  }

  return ok(info, '获取股票基础信息成功')
}
