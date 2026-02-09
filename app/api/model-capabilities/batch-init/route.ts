import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { defaultModelConfigs } from '@/lib/model-capabilities'

interface Payload {
  overwrite?: boolean
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const overwrite = body.overwrite === true
  const db = await getDb()

  let added = 0
  let skipped = 0

  for (const [modelName, config] of Object.entries(defaultModelConfigs)) {
    const existing = await db.collection('model_capabilities').findOne({ user_id: user.userId, model_name: modelName })
    if (existing && !overwrite) {
      skipped += 1
      continue
    }

    await db.collection('model_capabilities').updateOne(
      { user_id: user.userId, model_name: modelName },
      {
        $set: {
          ...config,
          user_id: user.userId,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    )
    added += 1
  }

  return ok(
    {
      added_count: added,
      skipped_count: skipped,
      overwrite
    },
    '批量初始化完成'
  )
}
