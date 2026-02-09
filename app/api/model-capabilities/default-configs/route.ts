import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { defaultModelConfigs } from '@/lib/model-capabilities'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  return ok(defaultModelConfigs, '获取默认模型能力配置成功')
}
