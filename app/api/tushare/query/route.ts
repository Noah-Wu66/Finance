import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasTushareLicence } from '@/lib/tushare-data'
import { callTushare11000, Tushare11000CallError } from '@/lib/tushare-11000-call'

interface QueryPayload {
  api_name?: string
  doc_id?: number | string
  params?: Record<string, unknown>
  fields?: string[] | string
  limit?: number | string
  offset?: number | string
  auto_fill_params?: boolean
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasTushareLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const body = (await request.json().catch(() => ({}))) as QueryPayload

  try {
    const result = await callTushare11000({
      apiName: body.api_name,
      docId: body.doc_id == null ? undefined : Number(body.doc_id),
      params: body.params,
      fields: body.fields,
      limit: body.limit == null ? undefined : Number(body.limit),
      offset: body.offset == null ? undefined : Number(body.offset),
      autoFillParams: body.auto_fill_params !== false
    })

    return ok(
      {
        endpoint: result.endpoint,
        params: result.params,
        fields: result.fields,
        persisted_to: 'tushare_api_data',
        count: result.records.length,
        records: result.records
      },
      `接口 ${result.endpoint.api_name} 调用成功`
    )
  } catch (error) {
    if (error instanceof Tushare11000CallError) {
      return fail(error.message, error.status, error.details)
    }
    return fail(
      '接口调用失败',
      500,
      error instanceof Error ? error.message : String(error)
    )
  }
}
