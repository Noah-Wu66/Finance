import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { userIdOrFilter } from '@/lib/mongo-helpers'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const { id } = await params
  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const conditions: Array<Record<string, unknown>> = [{ analysis_id: id }, { execution_id: id }]
  if (ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) })
  }

  const doc = await reports.findOne({
    $and: [
      userIdOrFilter(user.userId),
      { $or: conditions }
    ]
  })

  if (!doc) {
    return fail('报告不存在', 404)
  }

  return ok(doc, '获取报告详情成功')
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const { id } = await params
  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const conditions: Array<Record<string, unknown>> = [{ analysis_id: id }, { execution_id: id }]
  if (ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) })
  }

  const result = await reports.deleteOne({
    $and: [
      userIdOrFilter(user.userId),
      { $or: conditions }
    ]
  })

  if (result.deletedCount === 0) {
    return fail('报告不存在或无权删除', 404)
  }

  return ok(null, '报告已删除')
}
