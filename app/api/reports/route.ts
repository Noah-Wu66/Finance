import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { userIdOrFilter } from '@/lib/mongo-helpers'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') || '20')))
  const skip = (page - 1) * pageSize

  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const query = {
    ...userIdOrFilter(user.userId)
  }

  const [total, items] = await Promise.all([
    reports.countDocuments(query),
    reports
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(pageSize)
      .project({
        analysis_id: 1,
        stock_symbol: 1,
        stock_name: 1,
        market_type: 1,
        summary: 1,
        confidence_score: 1,
        risk_level: 1,
        created_at: 1,
        execution_id: 1,
        status: 1
      })
      .toArray()
  ])

  return ok(
    {
      total,
      page,
      page_size: pageSize,
      items
    },
    '获取报告列表成功'
  )
}
