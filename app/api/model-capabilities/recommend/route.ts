import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { recommendByDepth } from '@/lib/model-capabilities'

interface Payload {
  research_depth?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const depth = (body.research_depth || '标准').trim()
  const recommendation = recommendByDepth(depth)

  return ok(recommendation, '模型推荐成功')
}
