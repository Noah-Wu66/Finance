import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence, tusharePost } from '@/lib/mairui-data'
import { buildTushare11000Params } from '@/lib/tushare-11000-call'
import { getTushare11000Endpoints, normalizeTushareApiName } from '@/lib/tushare-11000'

interface SyncPayload {
  api_names?: string[]
  doc_ids?: Array<number | string>
  params?: Record<string, unknown>
  max_interfaces?: number
  auto_fill_params?: boolean
  dry_run?: boolean
  stop_on_error?: boolean
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
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
  const autoFillParams = body.auto_fill_params !== false
  const stopOnError = body.stop_on_error === true
  const requestedMax = toInt(body.max_interfaces, 0)

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

  const maxInterfaces = requestedMax > 0
    ? Math.min(Math.max(requestedMax, 1), 1000)
    : targets.length

  const limitedTargets = targets.slice(0, maxInterfaces)
  const results: Array<Record<string, unknown>> = []

  for (const endpoint of limitedTargets) {
    const params = autoFillParams
      ? buildTushare11000Params(endpoint, overrideParams)
      : { ...overrideParams }
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
      auto_fill_params: autoFillParams,
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
