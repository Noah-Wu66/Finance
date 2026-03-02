import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getTushare11000Endpoints } from '@/lib/tushare-11000'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const endpoints = await getTushare11000Endpoints()
    const basePath = '/api/tushare/apis'
    const items = endpoints.map((endpoint) => ({
      order: endpoint.order,
      interface_name: endpoint.interface_name,
      api_name: endpoint.api_name,
      doc_id: endpoint.doc_id,
      category: endpoint.category,
      params: endpoint.params,
      return_fields: endpoint.return_fields,
      invoke_get: endpoint.doc_id === undefined
        ? `${basePath}/${endpoint.api_name}`
        : `${basePath}/${endpoint.api_name}?doc_id=${endpoint.doc_id}`,
      invoke_post: `${basePath}/${endpoint.api_name}`
    }))

    const uniqueApiNames = Array.from(new Set(endpoints.map((item) => item.api_name)))
    return ok(
      {
        total_interfaces: endpoints.length,
        total_unique_apis: uniqueApiNames.length,
        items
      },
      `已接入 ${endpoints.length} 个接口条目`
    )
  } catch (error) {
    return fail('加载接口调用清单失败', 500, error instanceof Error ? error.message : String(error))
  }
}
