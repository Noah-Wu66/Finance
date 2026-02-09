import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { placeOrder } from '@/lib/paper-trading'

interface OrderPayload {
  code?: string
  side?: 'buy' | 'sell'
  quantity?: number
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json()) as OrderPayload
  const code = (body.code || '').trim().toUpperCase()
  const side = body.side
  const quantity = Number(body.quantity || 0)

  if (!code || !side || !['buy', 'sell'].includes(side) || !Number.isFinite(quantity) || quantity <= 0) {
    return fail('参数错误：请检查代码、方向和数量', 400)
  }

  try {
    const order = await placeOrder({
      userId: user.userId,
      code,
      side,
      quantity
    })

    return ok({ order }, '下单成功')
  } catch (error) {
    return fail(error instanceof Error ? error.message : '下单失败', 400)
  }
}
