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
      primary_source: {
        name: 'tushare',
        priority: 1,
        reason: '数据覆盖完整，现场执行稳定'
      },
      fallback_sources: [
        { name: 'akshare', priority: 2 },
        { name: 'baostock', priority: 3 }
      ],
      suggestions: ['建议优先使用 Tushare，缺失数据自动切换备用源。'],
      warnings: ['现场执行模式不会后台自动重试，请在页面内手动重跑。']
    },
    '获取同步建议成功'
  )
}
