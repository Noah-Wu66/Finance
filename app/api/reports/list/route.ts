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

  const searchKeyword = (request.nextUrl.searchParams.get('search_keyword') || '').trim()
  const marketFilter = (request.nextUrl.searchParams.get('market_filter') || '').trim()
  const stockCode = (request.nextUrl.searchParams.get('stock_code') || '').trim().toUpperCase()
  const startDate = (request.nextUrl.searchParams.get('start_date') || '').trim()
  const endDate = (request.nextUrl.searchParams.get('end_date') || '').trim()

  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const andFilters: Array<Record<string, unknown>> = [
    userIdOrFilter(user.userId)
  ]

  if (searchKeyword) {
    andFilters.push({
      $or: [
        { stock_symbol: { $regex: searchKeyword, $options: 'i' } },
        { stock_name: { $regex: searchKeyword, $options: 'i' } },
        { analysis_id: { $regex: searchKeyword, $options: 'i' } },
        { summary: { $regex: searchKeyword, $options: 'i' } }
      ]
    })
  }

  if (marketFilter) {
    andFilters.push({ market_type: marketFilter })
  }

  if (stockCode) {
    andFilters.push({ stock_symbol: stockCode })
  }

  if (startDate || endDate) {
    const dateFilter: Record<string, string> = {}
    if (startDate) dateFilter.$gte = startDate
    if (endDate) dateFilter.$lte = endDate
    andFilters.push({ analysis_date: dateFilter })
  }

  const query = {
    $and: andFilters
  }

  const [total, rows] = await Promise.all([
    reports.countDocuments(query),
    reports.find(query).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray()
  ])

  const items = rows.map((doc) => ({
    id: String(doc._id),
    analysis_id: String(doc.analysis_id || ''),
    title: `${String(doc.stock_name || doc.stock_symbol || '')}(${String(doc.stock_symbol || '')}) 分析报告`,
    stock_code: String(doc.stock_symbol || ''),
    stock_name: String(doc.stock_name || doc.stock_symbol || ''),
    market_type: String(doc.market_type || 'A股'),
    model_info: String(doc.model_info || 'live-engine'),
    type: 'single',
    format: 'markdown',
    status: String(doc.status || 'completed'),
    created_at: doc.created_at,
    analysis_date: doc.analysis_date || '',
    analysts: doc.analysts || [],
    research_depth: doc.research_depth || '全面',
    summary: String(doc.summary || ''),
    file_size: JSON.stringify(doc.reports || {}).length,
    source: String(doc.source || 'next-live'),
    execution_id: String(doc.execution_id || '')
  }))

  return ok(
    {
      reports: items,
      total,
      page,
      page_size: pageSize
    },
    '报告列表获取成功'
  )
}
