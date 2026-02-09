import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Params {
  params: { id: string }
}

interface Payload {
  name?: string
  description?: string
  type?: string
  config?: Record<string, unknown>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!ObjectId.isValid(params.id)) return fail('模板ID无效', 400)

  const db = await getDb()
  const row = await db.collection('templates').findOne({ _id: new ObjectId(params.id), user_id: user.userId })
  if (!row) return fail('模板不存在', 404)

  return ok(
    {
      id: String(row._id),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      type: row.type ? String(row.type) : undefined,
      config: row.config || {},
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    '获取模板成功'
  )
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!ObjectId.isValid(params.id)) return fail('模板ID无效', 400)

  const body = (await request.json().catch(() => ({}))) as Payload
  const update: Record<string, unknown> = { updated_at: new Date() }
  if (body.name !== undefined) update.name = String(body.name)
  if (body.description !== undefined) update.description = String(body.description)
  if (body.type !== undefined) update.type = String(body.type)
  if (body.config !== undefined) update.config = body.config

  const db = await getDb()
  const res = await db.collection('templates').updateOne(
    { _id: new ObjectId(params.id), user_id: user.userId },
    { $set: update }
  )

  if (!res.matchedCount) return fail('模板不存在', 404)
  return ok({ id: params.id }, '模板更新成功')
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!ObjectId.isValid(params.id)) return fail('模板ID无效', 400)

  const db = await getDb()
  const res = await db.collection('templates').deleteOne({
    _id: new ObjectId(params.id),
    user_id: user.userId
  })
  if (!res.deletedCount) return fail('模板不存在', 404)
  return ok(undefined, '模板删除成功')
}
