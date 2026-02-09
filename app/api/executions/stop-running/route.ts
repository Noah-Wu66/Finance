import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { cancelAllRunningExecutions } from '@/lib/execution-engine'
import { fail, ok } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const stopped = await cancelAllRunningExecutions(user.userId)
  return ok({ stopped }, '运行中任务已停止')
}
