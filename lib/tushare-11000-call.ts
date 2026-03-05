import { daysAgoYmd, tusharePost } from '@/lib/tushare-data'
import { todayYmd } from '@/lib/holiday'
import {
  findTushare11000Endpoint,
  findTushare11000EndpointsByApiName,
  normalizeTushareApiName,
  type Tushare11000Endpoint
} from '@/lib/tushare-11000'

export class Tushare11000CallError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'Tushare11000CallError'
    this.status = status
    this.details = details
  }
}

export interface CallTushare11000Input {
  apiName?: string
  docId?: number
  params?: Record<string, unknown>
  fields?: string[] | string
  limit?: number
  offset?: number
  autoFillParams?: boolean
}

export interface CallTushare11000Result {
  endpoint: Tushare11000Endpoint
  params: Record<string, unknown>
  fields: string[]
  records: Array<Record<string, unknown>>
}

function toSafeInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeFieldInput(fields: string[] | string | undefined): string[] {
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

function currentQuarter() {
  const now = new Date()
  const year = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${year}Q${q}`
}

function ensureValue(target: Record<string, unknown>, key: string, value: unknown) {
  if (target[key] === undefined || target[key] === null || target[key] === '') {
    target[key] = value
  }
}

function applyEndpointSpecificDefaults(endpoint: Tushare11000Endpoint, target: Record<string, unknown>) {
  if (endpoint.api_name === 'hsgt_top10') {
    const current = String(target.market ?? '').trim().toUpperCase()
    if (!current || current === 'SSE' || current === 'SZSE') {
      target.market = 'SH'
    }
  }
  if (endpoint.api_name === 'stock_hsgt') {
    const current = String(target.exchange ?? '').trim().toUpperCase()
    if (!current || current === 'SSE' || current === 'SZSE') {
      target.exchange = 'SH'
    }
  }
}

export function buildTushare11000Params(endpoint: Tushare11000Endpoint, overrides: Record<string, unknown>): Record<string, unknown> {
  const today = todayYmd()
  const target: Record<string, unknown> = { ...overrides }

  if (endpoint.params.includes('start_date')) ensureValue(target, 'start_date', daysAgoYmd(30))
  if (endpoint.params.includes('end_date')) ensureValue(target, 'end_date', today)
  if (endpoint.params.includes('trade_date')) ensureValue(target, 'trade_date', today)
  if (endpoint.params.includes('date')) ensureValue(target, 'date', today)
  if (endpoint.params.includes('month')) ensureValue(target, 'month', today.slice(0, 6))
  if (endpoint.params.includes('quarter')) ensureValue(target, 'quarter', currentQuarter())
  if (endpoint.params.includes('list_date')) ensureValue(target, 'list_date', '19900101')

  if (endpoint.params.includes('ts_code')) ensureValue(target, 'ts_code', '000001.SZ')
  if (endpoint.params.includes('exchange')) ensureValue(target, 'exchange', 'SSE')
  if (endpoint.params.includes('market')) ensureValue(target, 'market', 'SSE')
  if (endpoint.params.includes('cur_status')) ensureValue(target, 'cur_status', 'L')
  if (endpoint.params.includes('list_status')) ensureValue(target, 'list_status', 'L')
  if (endpoint.params.includes('is_open')) ensureValue(target, 'is_open', '1')
  if (endpoint.params.includes('call_put')) ensureValue(target, 'call_put', 'C')
  if (endpoint.params.includes('underlying_type')) ensureValue(target, 'underlying_type', 'E')
  if (endpoint.params.includes('freq')) ensureValue(target, 'freq', 'D')
  if (endpoint.params.includes('adj')) ensureValue(target, 'adj', 'qfq')
  if (endpoint.params.includes('report_type')) ensureValue(target, 'report_type', '1')
  if (endpoint.params.includes('type')) ensureValue(target, 'type', 'P')
  if (endpoint.params.includes('holder_type')) ensureValue(target, 'holder_type', 'G')
  if (endpoint.params.includes('target_type')) ensureValue(target, 'target_type', '1')
  if (endpoint.params.includes('limit_type')) ensureValue(target, 'limit_type', 'up')

  if (endpoint.params.includes('start_time')) ensureValue(target, 'start_time', '09:30:00')
  if (endpoint.params.includes('end_time')) ensureValue(target, 'end_time', '15:00:00')
  if (endpoint.params.includes('industry_code')) ensureValue(target, 'industry_code', '881001')
  if (endpoint.params.includes('concept_code')) ensureValue(target, 'concept_code', 'BK1036')
  if (endpoint.params.includes('block_code')) ensureValue(target, 'block_code', '880001')
  if (endpoint.params.includes('capital_id')) ensureValue(target, 'capital_id', '1')
  if (endpoint.params.includes('capital_type')) ensureValue(target, 'capital_type', '1')
  if (endpoint.params.includes('bank')) ensureValue(target, 'bank', '工商银行')
  if (endpoint.params.includes('fields')) ensureValue(target, 'fields', 'ma5,ma10,ma20')

  if (endpoint.params.includes('limit')) ensureValue(target, 'limit', 200)
  if (endpoint.params.includes('offset')) ensureValue(target, 'offset', 0)

  applyEndpointSpecificDefaults(endpoint, target)

  return target
}

async function resolveEndpoint(input: { apiName?: string; docId?: number }): Promise<Tushare11000Endpoint> {
  const apiName = normalizeTushareApiName(input.apiName || '')
  const docId = input.docId

  if (!apiName && docId === undefined) {
    throw new Tushare11000CallError('api_name 和 doc_id 至少提供一个', 400)
  }

  if (apiName && docId === undefined) {
    const sameNameEndpoints = await findTushare11000EndpointsByApiName(apiName)
    if (sameNameEndpoints.length > 1) {
      throw new Tushare11000CallError(
        `接口 ${apiName} 在文档里有多个条目，请同时传 doc_id 精准定位`,
        400,
        sameNameEndpoints.map((item) => ({ doc_id: item.doc_id, interface_name: item.interface_name }))
      )
    }
  }

  const endpoint = await findTushare11000Endpoint({ apiName, docId })
  if (!endpoint) {
    throw new Tushare11000CallError('未找到对应接口，请检查 api_name 或 doc_id', 404)
  }
  return endpoint
}

export async function callTushare11000(input: CallTushare11000Input): Promise<CallTushare11000Result> {
  const docId = toSafeInteger(input.docId)
  const endpoint = await resolveEndpoint({
    apiName: input.apiName,
    docId
  })

  const limit = toSafeInteger(input.limit)
  const offset = toSafeInteger(input.offset)

  const rawParams: Record<string, unknown> =
    input.params && typeof input.params === 'object' && !Array.isArray(input.params)
      ? { ...input.params }
      : {}

  if (limit !== undefined && rawParams.limit === undefined) rawParams.limit = limit
  if (offset !== undefined && rawParams.offset === undefined) rawParams.offset = offset

  const params = input.autoFillParams === false
    ? rawParams
    : buildTushare11000Params(endpoint, rawParams)

  const requestedFields = normalizeFieldInput(input.fields)
  const fields = uniqueKeepOrder(requestedFields.length > 0 ? requestedFields : endpoint.return_fields)
  if (fields.length === 0) {
    throw new Tushare11000CallError(`接口 ${endpoint.api_name} 未定义可用字段，请手动传 fields`, 400)
  }

  const records = await tusharePost(endpoint.api_name, params, fields)
  return {
    endpoint,
    params,
    fields,
    records
  }
}
