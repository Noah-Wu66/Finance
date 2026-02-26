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
        name: 'mairui',
        priority: 1,
        reason: '接口覆盖全面，支持A股/指数/京市/科创/基金'
      },
      fallback_sources: [],
      suggestions: ['系统已切换为仅使用麦蕊数据源。'],
      warnings: ['请确保 Vercel 已配置 MAIRUI_LICENCE。']
    },
    '获取同步建议成功'
  )
}
