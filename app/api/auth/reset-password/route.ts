import { NextRequest } from 'next/server'

import { fail, ok } from '@/lib/http'

interface Payload {
  email?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Payload
  const email = (body.email || '').trim()
  if (!email) {
    return fail('邮箱不能为空', 400)
  }

  return ok(
    {
      email,
      notice: '现场执行模式下不发送邮件，请联系管理员在用户管理页重置密码。'
    },
    '重置请求已受理'
  )
}
