import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { clearSyncCache } from '@/lib/sync-service'

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const data = await clearSyncCache()
  return ok(data, '同步缓存已清空')
}
