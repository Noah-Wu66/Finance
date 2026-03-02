import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { normalizeTushareApiName } from '@/lib/tushare-11000'

const RAW_COLLECTION = 'tushare_api_data'

function toSafeInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const apiName = normalizeTushareApiName(request.nextUrl.searchParams.get('api_name') || '')
  if (!apiName) return fail('api_name 不能为空', 400)

  const limit = Math.min(Math.max(toSafeInt(request.nextUrl.searchParams.get('limit'), 100), 1), 1000)
  const offset = Math.max(toSafeInt(request.nextUrl.searchParams.get('offset'), 0), 0)
  const includeMeta = (request.nextUrl.searchParams.get('meta') || '0') === '1'

  const query: Record<string, unknown> = { api_name: apiName }

  const docIdText = request.nextUrl.searchParams.get('doc_id')
  if (docIdText) {
    const docId = Number.parseInt(docIdText, 10)
    if (Number.isFinite(docId)) query.doc_id = docId
  }

  const tsCode = (request.nextUrl.searchParams.get('ts_code') || '').trim().toUpperCase()
  if (tsCode) query.ts_code = tsCode

  const tradeDate = (request.nextUrl.searchParams.get('trade_date') || '').trim()
  if (tradeDate) query.trade_date = tradeDate

  const startDate = (request.nextUrl.searchParams.get('start_date') || '').trim()
  const endDate = (request.nextUrl.searchParams.get('end_date') || '').trim()
  if (startDate || endDate) {
    const range: Record<string, string> = {}
    if (startDate) range.$gte = startDate
    if (endDate) range.$lte = endDate
    query.trade_date = range
  }

  request.nextUrl.searchParams.forEach((value, key) => {
    if (!key.startsWith('f_')) return
    const field = key.slice(2).trim()
    if (!field) return
    query[`data.${field}`] = value
  })

  try {
    const db = await getDb()
    const total = await db.collection(RAW_COLLECTION).countDocuments(query)
    const rows = await db.collection(RAW_COLLECTION)
      .find(query)
      .sort({ fetched_at: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    const items = rows.map((row) => {
      const payload = row.data as Record<string, unknown>
      if (!includeMeta) return payload
      return {
        api_name: row.api_name,
        doc_id: row.doc_id,
        row_key: row.row_key,
        fetched_at: row.fetched_at,
        data: payload
      }
    })

    return ok(
      {
        api_name: apiName,
        total,
        limit,
        offset,
        count: items.length,
        items
      },
      `已返回 ${items.length} 条`
    )
  } catch (error) {
    return fail('查询对齐数据失败', 500, error instanceof Error ? error.message : String(error))
  }
}
