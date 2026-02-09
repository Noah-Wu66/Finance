import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getLatestSyncStatus } from '@/lib/sync-service'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const status = await getLatestSyncStatus()
  return ok(status, '获取同步状态成功')
}
