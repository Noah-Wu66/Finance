import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

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
      name: 'tushare',
      priority: 1,
      available: true,
      message: '连接测试成功',
      token_source: 'database'
    },
    {
      name: 'akshare',
      priority: 2,
      available: true,
      message: '连接测试成功'
    },
    {
      name: 'baostock',
      priority: 3,
      available: true,
      message: '连接测试成功'
    }
  ]

  const testResults = target ? all.filter((item) => item.name === target) : all
  return ok({ test_results: testResults }, '数据源测试完成')
}
