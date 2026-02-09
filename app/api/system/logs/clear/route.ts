import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { clearOperationLogs } from '@/lib/operation-logs'

interface Payload {
  days?: number
  action_type?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  let body: Payload = {}
  try {
    body = (await request.json()) as Payload
  } catch {
  }

  const data = await clearOperationLogs(user.userId, body.days, body.action_type)
  return ok(data, '日志清理成功')
}
