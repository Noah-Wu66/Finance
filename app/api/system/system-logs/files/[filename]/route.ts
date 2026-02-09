import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Params {
  params: Promise<{ filename: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const { filename } = await params

  return ok({ filename }, '现场执行模式下日志为数据库记录，文件删除已忽略')
}
