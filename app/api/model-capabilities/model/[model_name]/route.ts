import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { defaultModelConfigs } from '@/lib/model-capabilities'

interface Params {
  params: { model_name: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const modelName = params.model_name
  const db = await getDb()
  const row = await db.collection('model_capabilities').findOne({ user_id: user.userId, model_name: modelName })

  if (row) {
    return ok(
      {
        model_name: String(row.model_name),
        capability_level: Number(row.capability_level || 2),
        suitable_roles: row.suitable_roles || [],
        features: row.features || [],
        recommended_depths: row.recommended_depths || [],
        performance_metrics: row.performance_metrics || {},
        description: row.description ? String(row.description) : undefined
      },
      '获取模型能力成功'
    )
  }

  const fallback = defaultModelConfigs[modelName as keyof typeof defaultModelConfigs]
  if (fallback) {
    return ok(fallback, '获取模型能力成功（默认）')
  }

  return fail('模型能力信息不存在', 404)
}
