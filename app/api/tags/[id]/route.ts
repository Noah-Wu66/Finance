import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Params {
  params: Promise<{ id: string }>
}

interface Payload {
  name?: string
  color?: string
  sort_order?: number
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { id } = await params
  if (!ObjectId.isValid(id)) return fail('标签ID无效', 400)

  const body = (await request.json().catch(() => ({}))) as Payload
  const update: Record<string, unknown> = { updated_at: new Date() }
  if (body.name !== undefined) update.name = String(body.name)
  if (body.color !== undefined) update.color = String(body.color)
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)

  const db = await getDb()
  const res = await db.collection('tags').updateOne(
    { _id: new ObjectId(id), user_id: user.userId },
    { $set: update }
  )

  if (!res.matchedCount) return fail('标签不存在', 404)
  return ok({ id }, '标签更新成功')
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { id } = await params
  if (!ObjectId.isValid(id)) return fail('标签ID无效', 400)

  const db = await getDb()
  const res = await db.collection('tags').deleteOne({
    _id: new ObjectId(id),
    user_id: user.userId
  })
  if (!res.deletedCount) return fail('标签不存在', 404)
  return ok({ id }, '标签删除成功')
}
