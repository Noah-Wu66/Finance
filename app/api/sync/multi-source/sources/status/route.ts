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
    [
      {
        name: 'mairui',
        priority: 1,
        available: hasMairuiLicence(),
        description: '麦蕊数据源',
        token_source: 'env(MAIRUI_LICENCE)'
      }
    ],
    '获取数据源状态成功'
  )
}
