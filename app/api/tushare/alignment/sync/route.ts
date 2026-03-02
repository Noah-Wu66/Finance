import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { daysAgoYmd, hasMairuiLicence, todayYmd, tusharePost } from '@/lib/mairui-data'
import { getTushare11000Endpoints, normalizeTushareApiName } from '@/lib/tushare-11000'

interface SyncPayload {
  api_names?: string[]
  doc_ids?: Array<number | string>
  params?: Record<string, unknown>
  max_interfaces?: number
  dry_run?: boolean
  stop_on_error?: boolean
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function currentQuarter() {
  const now = new Date()
  const year = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${year}Q${q}`
}

function buildParams(endpointParams: string[], overrides: Record<string, unknown>) {
  const today = todayYmd()
  const base: Record<string, unknown> = { ...overrides }

  const ensure = (key: string, value: unknown) => {
    if (base[key] === undefined || base[key] === null || base[key] === '') {
      base[key] = value
    }
  }

  if (endpointParams.includes('start_date')) ensure('start_date', daysAgoYmd(30))
  if (endpointParams.includes('end_date')) ensure('end_date', today)
  if (endpointParams.includes('trade_date')) ensure('trade_date', today)
  if (endpointParams.includes('date')) ensure('date', today)
  if (endpointParams.includes('month')) ensure('month', today.slice(0, 6))
  if (endpointParams.includes('quarter')) ensure('quarter', currentQuarter())
  if (endpointParams.includes('exchange')) ensure('exchange', 'SSE')
  if (endpointParams.includes('market')) ensure('market', 'SSE')
  if (endpointParams.includes('list_status')) ensure('list_status', 'L')
  if (endpointParams.includes('freq')) ensure('freq', 'D')
  if (endpointParams.includes('call_put')) ensure('call_put', 'C')
  if (endpointParams.includes('target_type')) ensure('target_type', '1')
  if (endpointParams.includes('limit_type')) ensure('limit_type', 'up')
  if (endpointParams.includes('limit')) ensure('limit', 200)
  if (endpointParams.includes('offset')) ensure('offset', 0)

  return base
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 TUSHARE_TOKEN', 503)

  const body = (await request.json().catch(() => ({}))) as SyncPayload
  const selectedApiNames = (Array.isArray(body.api_names) ? body.api_names : [])
    .map((item) => normalizeTushareApiName(item))
    .filter((item) => item)

  const selectedDocIds = (Array.isArray(body.doc_ids) ? body.doc_ids : [])
    .map((item) => toInt(item, NaN))
    .filter((item) => Number.isFinite(item))

  const overrideParams =
    body.params && typeof body.params === 'object' && !Array.isArray(body.params)
      ? { ...body.params }
      : {}

  const dryRun = body.dry_run === true
  const stopOnError = body.stop_on_error === true
  const maxInterfaces = Math.min(Math.max(toInt(body.max_interfaces, 120), 1), 500)

  const allEndpoints = await getTushare11000Endpoints()
  let targets = allEndpoints

  if (selectedApiNames.length > 0) {
    targets = targets.filter((endpoint) => selectedApiNames.includes(endpoint.api_name))
  }
  if (selectedDocIds.length > 0) {
    targets = targets.filter((endpoint) => endpoint.doc_id !== undefined && selectedDocIds.includes(endpoint.doc_id))
  }

  if (targets.length === 0) {
    return fail('没有匹配到可同步的接口', 400)
  }

  const limitedTargets = targets.slice(0, maxInterfaces)
  const results: Array<Record<string, unknown>> = []

  for (const endpoint of limitedTargets) {
    const params = buildParams(endpoint.params, overrideParams)
    const fields = endpoint.return_fields

    if (dryRun) {
      results.push({
        order: endpoint.order,
        api_name: endpoint.api_name,
        doc_id: endpoint.doc_id,
        interface_name: endpoint.interface_name,
        params,
        fields,
        status: 'dry_run'
      })
      continue
    }

    try {
      const rows = await tusharePost(endpoint.api_name, params, fields)
      results.push({
        order: endpoint.order,
        api_name: endpoint.api_name,
        doc_id: endpoint.doc_id,
        interface_name: endpoint.interface_name,
        params,
        fields_count: fields.length,
        rows_count: rows.length,
        status: 'ok'
      })
    } catch (error) {
      results.push({
        order: endpoint.order,
        api_name: endpoint.api_name,
        doc_id: endpoint.doc_id,
        interface_name: endpoint.interface_name,
        params,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
      if (stopOnError) break
    }
  }

  const successCount = results.filter((item) => item.status === 'ok').length
  const errorCount = results.filter((item) => item.status === 'error').length

  return ok(
    {
      dry_run: dryRun,
      requested_interfaces: targets.length,
      executed_interfaces: limitedTargets.length,
      success_count: successCount,
      error_count: errorCount,
      truncated: targets.length > limitedTargets.length,
      results
    },
    dryRun ? '对齐预演完成' : '接口对齐同步完成'
  )
}
