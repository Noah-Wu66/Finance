import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence } from '@/lib/mairui-data'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    {
      name: 'mairui',
      priority: 1,
      available: hasMairuiLicence(),
      description: '现场执行模式仅使用麦蕊数据源',
      token_source: 'env(MAIRUI_LICENCE)',
      token_source_display: '环境变量'
    },
    '获取当前数据源成功'
  )
}
