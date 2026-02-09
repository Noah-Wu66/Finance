import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    {
      name: 'tushare',
      priority: 1,
      description: '现场执行模式默认使用 Tushare 优先策略',
      token_source: 'database',
      token_source_display: '数据库配置'
    },
    '获取当前数据源成功'
  )
}
