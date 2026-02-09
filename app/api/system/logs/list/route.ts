import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { listOperationLogs } from '@/lib/operation-logs'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') || '20')))
  const actionType = request.nextUrl.searchParams.get('action_type') || undefined
  const successParam = request.nextUrl.searchParams.get('success')
  const success = successParam === null ? undefined : successParam === 'true'
  const keyword = request.nextUrl.searchParams.get('keyword') || undefined

  const data = await listOperationLogs(user.userId, {
    page,
    pageSize,
    actionType,
    success,
    keyword
  })

  return ok(data, '获取操作日志成功')
}
