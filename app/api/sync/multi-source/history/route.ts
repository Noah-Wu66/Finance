import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getSyncHistory } from '@/lib/sync-service'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') || '20')))
  const status = request.nextUrl.searchParams.get('status') || undefined

  const data = await getSyncHistory(page, pageSize, status)
  return ok(data, '获取同步历史成功')
}
