import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence } from '@/lib/mairui-data'
import { callTushare11000, Tushare11000CallError } from '@/lib/tushare-11000-call'

interface RouteContext {
  params: Promise<{ api_name: string }>
}

const RESERVED_QUERY_KEYS = new Set(['fields', 'doc_id', 'limit', 'offset', 'auto_fill_params'])

function toSafeInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseAutoFillFlag(value: string | null | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off'
}

function parseParamsFromQuery(request: NextRequest): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    if (RESERVED_QUERY_KEYS.has(key)) return
    if (!key.trim()) return
    params[key] = value
  })
  return params
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const { api_name: apiNameInPath } = await context.params
  const fields = request.nextUrl.searchParams.get('fields') || undefined
  const docId = toSafeInteger(request.nextUrl.searchParams.get('doc_id'))
  const limit = toSafeInteger(request.nextUrl.searchParams.get('limit'))
  const offset = toSafeInteger(request.nextUrl.searchParams.get('offset'))
  const autoFillParams = parseAutoFillFlag(request.nextUrl.searchParams.get('auto_fill_params'))
  const params = parseParamsFromQuery(request)

  try {
    const result = await callTushare11000({
      apiName: apiNameInPath,
      docId,
      params,
      fields,
      limit,
      offset,
      autoFillParams
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
    return fail('接口调用失败', 500, error instanceof Error ? error.message : String(error))
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const { api_name: apiNameInPath } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    doc_id?: number | string
    params?: Record<string, unknown>
    fields?: string[] | string
    limit?: number | string
    offset?: number | string
    auto_fill_params?: boolean
  }

  try {
    const result = await callTushare11000({
      apiName: apiNameInPath,
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
    return fail('接口调用失败', 500, error instanceof Error ? error.message : String(error))
  }
}
