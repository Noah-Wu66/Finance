import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    [
      {
        name: 'tushare',
        priority: 1,
        available: true,
        description: 'Tushare 数据源',
        token_source: 'database'
      },
      {
        name: 'akshare',
        priority: 2,
        available: true,
        description: 'AKShare 数据源'
      },
      {
        name: 'baostock',
        priority: 3,
        available: true,
        description: 'BaoStock 数据源'
      }
    ],
    '获取数据源状态成功'
  )
}
