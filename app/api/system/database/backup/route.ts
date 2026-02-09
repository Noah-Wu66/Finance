import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Payload {
  name?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json().catch(() => ({}))) as Payload
  return ok(
    {
      id: `live-${Date.now()}`,
      name: body.name || 'manual-backup',
      filename: 'not-applicable',
      size: 0,
      collections: [],
      created_at: new Date().toISOString(),
      created_by: user.username
    },
    '现场执行模式下不提供服务器备份，建议使用 MongoDB 云端备份策略'
  )
}
