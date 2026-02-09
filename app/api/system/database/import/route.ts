import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail } from '@/lib/http'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return fail('现场执行模式下不支持服务端文件导入，请在数据库层完成导入', 400)
}
