import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getTushare11000Endpoints } from '@/lib/tushare-11000'

const RAW_COLLECTION = 'tushare_api_data'

interface AlignmentStatRow {
  _id: string
  stored_count: number
  last_fetched_at?: Date
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const includeItems = (request.nextUrl.searchParams.get('items') || '1') !== '0'

    const endpoints = await getTushare11000Endpoints()
    const uniqueApiNames = Array.from(new Set(endpoints.map((item) => item.api_name)))

    const db = await getDb()
    const stats = await db.collection(RAW_COLLECTION).aggregate<AlignmentStatRow>([
      {
        $group: {
          _id: '$api_name',
          stored_count: { $sum: 1 },
          last_fetched_at: { $max: '$fetched_at' }
        }
      }
    ]).toArray()

    const statMap = new Map(stats.map((item) => [String(item._id || ''), item]))
    const alignedUniqueApis = uniqueApiNames.filter((apiName) => statMap.has(apiName)).length
    const unmappedStorageApis = stats
      .map((item) => String(item._id || ''))
      .filter((apiName) => apiName && !uniqueApiNames.includes(apiName))

    const summary = {
      total_interfaces: endpoints.length,
      total_unique_apis: uniqueApiNames.length,
      aligned_unique_apis: alignedUniqueApis,
      unaligned_unique_apis: uniqueApiNames.length - alignedUniqueApis,
      alignment_ratio: uniqueApiNames.length > 0 ? Number((alignedUniqueApis / uniqueApiNames.length).toFixed(4)) : 0,
      unmapped_storage_apis: unmappedStorageApis
    }

    if (!includeItems) {
      return ok({ summary }, '对齐状态获取成功')
    }

    const items = endpoints.map((endpoint) => {
      const stat = statMap.get(endpoint.api_name)
      return {
        order: endpoint.order,
        interface_name: endpoint.interface_name,
        api_name: endpoint.api_name,
        doc_id: endpoint.doc_id,
        category: endpoint.category,
        aligned: Boolean(stat),
        stored_count: stat?.stored_count || 0,
        last_fetched_at: stat?.last_fetched_at || null
      }
    })

    return ok({ summary, items }, '对齐状态获取成功')
  } catch (error) {
    return fail('获取对齐状态失败', 500, error instanceof Error ? error.message : String(error))
  }
}
