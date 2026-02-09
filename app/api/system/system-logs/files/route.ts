import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const now = new Date().toISOString()
  return ok(
    [
      {
        name: 'operation.log',
        path: 'mongodb://operation_logs',
        size: 0,
        size_mb: 0,
        modified_at: now,
        type: 'other'
      },
      {
        name: 'analysis.log',
        path: 'mongodb://web_executions',
        size: 0,
        size_mb: 0,
        modified_at: now,
        type: 'webapi'
      }
    ],
    '获取日志文件列表成功'
  )
}
