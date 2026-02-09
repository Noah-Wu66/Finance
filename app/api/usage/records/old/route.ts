import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { deleteOldUsageRecords } from '@/lib/usage'

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const days = Math.max(1, Number(request.nextUrl.searchParams.get('days') || '90'))
  const data = await deleteOldUsageRecords(user.userId, days)
  return ok(data, '旧记录已删除')
}
