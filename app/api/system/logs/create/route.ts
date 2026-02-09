import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { createOperationLog } from '@/lib/operation-logs'

interface Payload {
  action_type?: string
  action?: string
  details?: Record<string, unknown>
  success?: boolean
  error_message?: string
  duration_ms?: number
  session_id?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as Payload
  if (!body.action_type || !body.action) {
    return fail('action_type 和 action 不能为空', 400)
  }

  const logId = await createOperationLog({
    userId: user.userId,
    username: user.username,
    actionType: body.action_type,
    action: body.action,
    details: body.details,
    success: body.success,
    errorMessage: body.error_message,
    durationMs: body.duration_ms,
    sessionId: body.session_id,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined
  })

  return ok({ log_id: logId }, '日志创建成功')
}
