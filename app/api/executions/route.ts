import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { listExecutions, startExecution } from '@/lib/execution-engine'

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
  }

  const symbol = (body.symbol || '').trim()
  if (!symbol) {
    return fail('请输入股票代码', 400)
  }

  const market = (body.market || 'A股').trim()

  const executionId = await startExecution({
    userId: user.userId,
    userEmail: user.email,
    symbol,
    market,
    depth: '全面'
  })

  return ok(
    {
      execution_id: executionId
    },
    '已创建现场执行任务'
  )
}
