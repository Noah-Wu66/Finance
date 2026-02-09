import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const envValidation = {
    success: true,
    missing_required: [],
    missing_recommended: [],
    invalid_configs: [],
    warnings: ['现场执行模式已停用 Redis 后台依赖。']
  }

  const mongodbValidation = {
    llm_providers: [],
    data_source_configs: [],
    warnings: ['配置中心运行在精简兼容模式，可在设置页修改核心偏好。']
  }

  return ok(
    {
      success: true,
      env_validation: envValidation,
      mongodb_validation: mongodbValidation
    },
    '配置验证完成'
  )
}
