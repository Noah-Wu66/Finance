import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Params {
  params: Promise<{ backup_id: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const { backup_id } = await params

  return ok({ backup_id }, '现场执行模式下无服务器备份文件可删除')
}
