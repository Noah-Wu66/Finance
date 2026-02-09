import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getLatestQuoteByCode } from '@/lib/stock-data'

interface Params {
  params: { market: string; code: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const quote = await getLatestQuoteByCode(params.code)
  if (!quote) {
    return fail('行情不存在', 404)
  }

  return ok(quote, '获取行情成功')
}
