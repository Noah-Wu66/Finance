import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { resetAccount } from '@/lib/paper-trading'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const confirm = request.nextUrl.searchParams.get('confirm')
  if (confirm !== 'true') {
    return fail('请携带 confirm=true 再执行重置', 400)
  }

  const data = await resetAccount(user.userId)
  return ok(data, '账户已重置')
}
