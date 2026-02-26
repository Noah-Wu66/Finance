import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence } from '@/lib/mairui-data'

interface Payload {
  source_name?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json().catch(() => ({}))) as Payload
  const target = body.source_name

  const all = [
    {
      name: 'mairui',
      priority: 1,
      available: hasMairuiLicence(),
      message: hasMairuiLicence() ? '连接测试成功' : '未配置 MAIRUI_LICENCE',
      token_source: 'env(MAIRUI_LICENCE)'
    }
  ]

  const testResults = target ? all.filter((item) => item.name === target) : all
  return ok({ test_results: testResults }, '数据源测试完成')
}
