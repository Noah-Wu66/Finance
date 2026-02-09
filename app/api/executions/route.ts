import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { listExecutions, startExecution } from '@/lib/execution-engine'

const DEPTH_LIST = ['快速', '标准', '深度'] as const

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '50')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50
  const items = await listExecutions(user.userId, limit)

  return ok(items, '获取执行列表成功')
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as {
    symbol?: string
    market?: string
    depth?: (typeof DEPTH_LIST)[number]
  }

  const symbol = (body.symbol || '').trim()
  if (!symbol) {
    return fail('请输入股票代码', 400)
  }

  const market = (body.market || 'A股').trim()
  const depthInput = (body.depth || '标准') as (typeof DEPTH_LIST)[number]
  const depth = DEPTH_LIST.includes(depthInput) ? depthInput : '标准'

  const executionId = await startExecution({
    userId: user.userId,
    username: user.username,
    symbol,
    market,
    depth
  })

  return ok(
    {
      execution_id: executionId
    },
    '已创建现场执行任务'
  )
}
