import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { deleteExecution, getExecutionById } from '@/lib/execution-engine'
import { fail, ok } from '@/lib/http'

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const { id } = params
    const item = await getExecutionById(id, user.userId)
    if (!item) {
      return fail('任务不存在', 404)
    }
    return ok(item, '获取任务详情成功')
  } catch (error) {
    return fail('任务ID无效', 400, error instanceof Error ? error.message : String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const { id } = params
    await deleteExecution(id, user.userId)
    return ok({ id }, '任务已删除')
  } catch (error) {
    return fail('删除失败', 400, error instanceof Error ? error.message : String(error))
  }
}
