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

  const { id: reportId } = await params
  const db = await getDb()

  const query: Array<Record<string, unknown>> = [{ analysis_id: reportId }, { execution_id: reportId }]
  if (ObjectId.isValid(reportId)) {
    query.push({ _id: new ObjectId(reportId) })
  }

  const doc = await db.collection('analysis_reports').findOne({
    $and: [
      userIdOrFilter(user.userId),
      { $or: query }
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
      key_points: doc.key_points || [],
      predicted_kline: doc.predicted_kline || [],
      kline_history: doc.kline_history || [],
      next_trading_days: doc.next_trading_days || [],
      benchmark_summary: doc.benchmark_summary || [],
      fund_flow: doc.fund_flow || [],
      stock_events: doc.stock_events || [],
      financial_enhanced: doc.financial_enhanced || null,
      news_sentiment_summary: doc.news_sentiment_summary || null,
      adjust_factors: doc.adjust_factors || [],
      corporate_actions: doc.corporate_actions || [],
      industry_aggregation: doc.industry_aggregation || [],
      earnings_expectation: doc.earnings_expectation || [],
      macro_calendar: doc.macro_calendar || [],
      intraday_data: doc.intraday_data || [],
      data_quality_summary: doc.data_quality_summary || null,
      news: doc.news || [],
      ai_powered: Boolean(doc.ai_powered),
      reports: doc.reports || {},
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      analysis_date: doc.analysis_date || ''
    },
    '获取报告详情成功'
  )
}
