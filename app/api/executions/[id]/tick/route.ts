import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { tickExecution } from '@/lib/execution-engine'
import { fail, ok } from '@/lib/http'

interface Params {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const { id } = params
    const item = await tickExecution(id, user.userId)
    return ok(item, '执行推进成功')
  } catch (error) {
    return fail('执行推进失败', 400, error instanceof Error ? error.message : String(error))
  }
}
