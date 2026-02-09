import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { cancelExecution } from '@/lib/execution-engine'
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
    await cancelExecution(id, user.userId)
    return ok({ id }, '任务已停止')
  } catch (error) {
    return fail('停止任务失败', 400, error instanceof Error ? error.message : String(error))
  }
}
