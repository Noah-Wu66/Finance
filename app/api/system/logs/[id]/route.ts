import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  if (!ObjectId.isValid(params.id)) {
    return fail('日志ID无效', 400)
  }

  const db = await getDb()
  const row = await db.collection('operation_logs').findOne({
    _id: new ObjectId(params.id),
    $or: [{ user_id: user.userId }, { user_id: user.userId.toString() }]
  })

  if (!row) {
    return fail('日志不存在', 404)
  }

  return ok(
    {
      id: String(row._id),
      user_id: String(row.user_id || ''),
      username: String(row.username || ''),
      action_type: String(row.action_type || ''),
      action: String(row.action || ''),
      details: row.details || {},
      success: Boolean(row.success),
      error_message: row.error_message ? String(row.error_message) : undefined,
      duration_ms: Number(row.duration_ms || 0),
      ip_address: row.ip_address ? String(row.ip_address) : undefined,
      user_agent: row.user_agent ? String(row.user_agent) : undefined,
      session_id: row.session_id ? String(row.session_id) : undefined,
      timestamp: row.timestamp || row.created_at,
      created_at: row.created_at
    },
    '获取日志详情成功'
  )
}
