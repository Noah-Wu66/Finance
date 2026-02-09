import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { validateModelPair } from '@/lib/model-capabilities'

interface Payload {
  quick_model?: string
  deep_model?: string
  research_depth?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const quickModel = (body.quick_model || '').trim()
  const deepModel = (body.deep_model || '').trim()
  const depth = (body.research_depth || '标准').trim()

  if (!quickModel || !deepModel) {
    return fail('quick_model 和 deep_model 不能为空', 400)
  }

  const result = validateModelPair(quickModel, deepModel, depth)
  return ok(result, '模型验证完成')
}
