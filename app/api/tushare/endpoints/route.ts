import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getTushare11000Endpoints, normalizeTushareApiName } from '@/lib/tushare-11000'

const RAW_COLLECTION = 'tushare_api_data'

function includesText(source: string, keyword: string): boolean {
  if (!keyword) return true
  return source.toLowerCase().includes(keyword.toLowerCase())
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const keyword = (request.nextUrl.searchParams.get('keyword') || '').trim()
    const apiNameFilter = normalizeTushareApiName(request.nextUrl.searchParams.get('api_name') || '')
    const categoryFilter = (request.nextUrl.searchParams.get('category') || '').trim()
    const withStats = (request.nextUrl.searchParams.get('with_stats') || '0') === '1'
    const docIdText = (request.nextUrl.searchParams.get('doc_id') || '').trim()
    const parsedDocId = docIdText ? Number.parseInt(docIdText, 10) : undefined
    const docIdFilter = parsedDocId !== undefined && Number.isFinite(parsedDocId) ? parsedDocId : undefined

    const endpoints = await getTushare11000Endpoints()
    let statsMap = new Map<string, { stored_count: number; last_fetched_at: Date }>()
    if (withStats) {
      const db = await getDb()
      const stats = await db.collection(RAW_COLLECTION).aggregate<{
        _id: string
        stored_count: number
        last_fetched_at: Date
      }>([
        {
          $group: {
            _id: '$api_name',
            stored_count: { $sum: 1 },
            last_fetched_at: { $max: '$fetched_at' }
          }
        }
      ]).toArray()
      statsMap = new Map(stats.map((item) => [String(item._id || ''), {
        stored_count: Number(item.stored_count || 0),
        last_fetched_at: item.last_fetched_at
      }]))
    }

    const filtered = endpoints.filter((item) => {
      if (apiNameFilter && item.api_name !== apiNameFilter) return false
      if (categoryFilter && item.category !== categoryFilter) return false
      if (docIdFilter !== undefined && item.doc_id !== docIdFilter) return false

      if (!keyword) return true
      return (
        includesText(item.interface_name, keyword) ||
        includesText(item.api_name, keyword) ||
        includesText(item.category, keyword) ||
        includesText(item.description, keyword)
      )
    })

    const categories = Array.from(new Set(endpoints.map((item) => item.category))).sort((a, b) => a.localeCompare(b))
    return ok(
      {
        total: endpoints.length,
        matched: filtered.length,
        categories,
        items: filtered.map((item) => {
          const stat = statsMap.get(item.api_name)
          if (!withStats) return item
          return {
            ...item,
            aligned: Boolean(stat),
            stored_count: stat?.stored_count || 0,
            last_fetched_at: stat?.last_fetched_at || null
          }
        })
      },
      `已加载 ${filtered.length} 个接口`
    )
  } catch (error) {
    return fail('加载接口目录失败', 500, error instanceof Error ? error.message : String(error))
  }
}
