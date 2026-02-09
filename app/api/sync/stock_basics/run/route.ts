import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { runStockBasicsSync } from '@/lib/sync-service'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const result = await runStockBasicsSync(false)
  return ok(result, '同步执行成功')
}
