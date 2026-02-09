import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  return ok(
    {
      verified: true,
      note: '现场执行模式下邮箱验证已简化，当前账号视为已验证。'
    },
    '邮箱验证成功'
  )
}
