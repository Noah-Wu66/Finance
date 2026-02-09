import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    {
      deleted_count: 0,
      cleaned_collections: ['operation_logs'],
      cutoff_date: new Date().toISOString()
    },
    '现场执行模式下未自动删除日志'
  )
}
