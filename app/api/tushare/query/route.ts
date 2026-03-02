import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence, tusharePost } from '@/lib/mairui-data'
import {
  findTushare11000EndpointsByApiName,
  findTushare11000Endpoint,
  normalizeTushareApiName
} from '@/lib/tushare-11000'

interface QueryPayload {
  api_name?: string
  doc_id?: number | string
  params?: Record<string, unknown>
  fields?: string[] | string
  limit?: number | string
  offset?: number | string
}

function toSafeInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeFieldInput(fields: QueryPayload['fields']): string[] {
  if (Array.isArray(fields)) {
    return fields
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => /^[a-z][a-z0-9_]*$/i.test(item))
  }

  if (typeof fields === 'string') {
    const matches = fields.match(/[A-Za-z][A-Za-z0-9_]*/g) || []
    return matches.map((item) => item.toLowerCase())
  }

  return []
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const body = (await request.json().catch(() => ({}))) as QueryPayload
  const apiName = normalizeTushareApiName(body.api_name || '')
  const docId = toSafeInteger(body.doc_id)

  if (!apiName && docId === undefined) {
    return fail('api_name 和 doc_id 至少提供一个', 400)
  }

  if (apiName && docId === undefined) {
    const sameNameEndpoints = await findTushare11000EndpointsByApiName(apiName)
    if (sameNameEndpoints.length > 1) {
      return fail(
        `接口 ${apiName} 在文档里有多个条目，请同时传 doc_id 精准定位`,
        400,
        sameNameEndpoints.map((item) => ({ doc_id: item.doc_id, interface_name: item.interface_name }))
      )
    }
  }

  const endpoint = await findTushare11000Endpoint({ apiName, docId })
  if (!endpoint) {
    return fail('未找到对应接口，请检查 api_name 或 doc_id', 404)
  }

  const requestParams: Record<string, unknown> =
    body.params && typeof body.params === 'object' && !Array.isArray(body.params)
      ? { ...body.params }
      : {}

  const limit = toSafeInteger(body.limit)
  const offset = toSafeInteger(body.offset)
  if (limit !== undefined && requestParams.limit === undefined) requestParams.limit = limit
  if (offset !== undefined && requestParams.offset === undefined) requestParams.offset = offset

  const requestedFields = normalizeFieldInput(body.fields)
  const fields = uniqueKeepOrder(requestedFields.length > 0 ? requestedFields : endpoint.return_fields)
  if (fields.length === 0) {
    return fail(`接口 ${endpoint.api_name} 未定义可用字段，请手动传 fields`, 400)
  }

  try {
    const records = await tusharePost(endpoint.api_name, requestParams, fields)
    return ok(
      {
        endpoint,
        params: requestParams,
        fields,
        persisted_to: 'tushare_api_data',
        count: records.length,
        records
      },
      `接口 ${endpoint.api_name} 调用成功`
    )
  } catch (error) {
    return fail(
      `接口 ${endpoint.api_name} 调用失败`,
      500,
      error instanceof Error ? error.message : String(error)
    )
  }
}
