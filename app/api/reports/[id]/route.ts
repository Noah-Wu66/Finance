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

  return ok(
    {
      id: String(doc._id),
      analysis_id: String(doc.analysis_id || ''),
      execution_id: String(doc.execution_id || ''),
      stock_symbol: String(doc.stock_symbol || ''),
      stock_name: String(doc.stock_name || doc.stock_symbol || ''),
      market_type: String(doc.market_type || 'A股'),
      summary: String(doc.summary || ''),
      recommendation: String(doc.recommendation || ''),
      confidence_score: Number(doc.confidence_score || 0),
      risk_level: String(doc.risk_level || ''),
      key_points: Array.isArray(doc.key_points) ? doc.key_points : [],
      predicted_kline: Array.isArray(doc.predicted_kline) ? doc.predicted_kline : [],
      kline_history: Array.isArray(doc.kline_history) ? doc.kline_history : [],
      next_trading_days: Array.isArray(doc.next_trading_days) ? doc.next_trading_days : [],
      benchmark_summary: Array.isArray(doc.benchmark_summary) ? doc.benchmark_summary : [],
      fund_flow: Array.isArray(doc.fund_flow) ? doc.fund_flow : [],
      financial_enhanced: doc.financial_enhanced || null,
      news_sentiment_summary: doc.news_sentiment_summary || null,
      adjust_factors: Array.isArray(doc.adjust_factors) ? doc.adjust_factors : [],
      corporate_actions: Array.isArray(doc.corporate_actions) ? doc.corporate_actions : [],
      industry_aggregation: Array.isArray(doc.industry_aggregation) ? doc.industry_aggregation : [],
      earnings_expectation: Array.isArray(doc.earnings_expectation) ? doc.earnings_expectation : [],
      data_quality_summary: doc.data_quality_summary || null,
      news: Array.isArray(doc.news) ? doc.news : [],
      ai_powered: Boolean(doc.ai_powered),
      reports: doc.reports || {},
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      analysis_date: doc.analysis_date || ''
    },
    '获取报告详情成功'
  )
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
