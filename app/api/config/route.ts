import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  return ok(
    {
      mode: 'page_live_execution',
      scheduler_enabled: false,
      websocket_enabled: false
    },
    '配置中心（精简版）'
  )
}
