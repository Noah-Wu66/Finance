import { createHash } from 'node:crypto'

import { getDb } from '@/lib/db'
import {
  findTushare11000Endpoint,
  isTushare11000SupportedApi,
  normalizeTushareApiName
} from '@/lib/tushare-11000'
import { TUSHARE_FINA_INDICATOR_FIELDS } from '@/lib/tushare-field-sets'

const TUSHARE_TOKEN = (process.env.TUSHARE_TOKEN || '').trim()
const TUSHARE_API = 'https://api.tushare.pro'
const TUSHARE_RAW_COLLECTION = 'tushare_api_data'
const TUSHARE_SYNC_LOG_COLLECTION = 'tushare_api_sync_logs'
const TUSHARE_AUTO_MIRROR = (process.env.TUSHARE_AUTO_MIRROR || '1').trim() !== '0'

let rawIndexReady = false

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function toYmd(value: unknown): string {
  const source = String(value || '').trim()
  if (!source) return ''
  const compact = source.replace(/[^0-9]/g, '')
  if (compact.length >= 8) return compact.slice(0, 8)
  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear().toString()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function todayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** 纯数字代码 → Tushare 带后缀代码：000001 → 000001.SZ */
function toTsCode(code: string): string {
  const raw = String(code || '').trim().toUpperCase()
  if (/\.(SH|SZ|BJ)$/i.test(raw)) return raw
  const num = raw.replace(/\.(SH|SZ|BJ)$/i, '')
  if (num.startsWith('6') || num.startsWith('9')) return `${num}.SH`
  if (num.startsWith('8') || num.startsWith('4')) return `${num}.BJ`
  return `${num}.SZ`
}

/** Tushare 代码 → 纯数字：000001.SZ → 000001 */
function fromTsCode(tsCode: string): string {
  return String(tsCode || '').trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, '')
}

function normalizeStockCode(code: string): string {
  return fromTsCode(code)
}

function stableRowHash(row: Record<string, unknown>): string {
  const keys = Object.keys(row).sort((a, b) => a.localeCompare(b))
  const payload = keys.map((key) => [key, row[key]])
  return createHash('sha1').update(JSON.stringify(payload)).digest('hex')
}

function buildRawRowKey(apiName: string, row: Record<string, unknown>, params: Record<string, unknown>): string {
  const candidates = [
    'ts_code', 'trade_date', 'end_date', 'ann_date', 'report_date', 'cal_date', 'date', 'month', 'quarter',
    'exchange', 'market', 'symbol', 'index_code', 'concept_code', 'block_code', 'capital_id', 'bank', 'type', 'holder_name'
  ]
  const parts: string[] = []

  for (const key of candidates) {
    const value = row[key]
    if (value === null || value === undefined || value === '') continue
    parts.push(`${key}=${String(value).trim()}`)
  }

  if (parts.length === 0) {
    const paramCandidates = ['ts_code', 'trade_date', 'start_date', 'end_date', 'month', 'quarter', 'exchange', 'market']
    for (const key of paramCandidates) {
      const value = params[key]
      if (value === null || value === undefined || value === '') continue
      parts.push(`p_${key}=${String(value).trim()}`)
    }
  }

  if (parts.length === 0) {
    parts.push(`hash=${stableRowHash(row)}`)
  }

  return `${apiName}|${parts.join('|')}`
}

async function ensureRawIndexes() {
  if (rawIndexReady) return
  const db = await getDb()
  await Promise.all([
    db.collection(TUSHARE_RAW_COLLECTION).createIndex({ api_name: 1, row_key: 1 }, { unique: true }),
    db.collection(TUSHARE_RAW_COLLECTION).createIndex({ api_name: 1, fetched_at: -1 }),
    db.collection(TUSHARE_RAW_COLLECTION).createIndex({ api_name: 1, ts_code: 1, trade_date: -1 }),
    db.collection(TUSHARE_SYNC_LOG_COLLECTION).createIndex({ api_name: 1, requested_at: -1 })
  ]).catch(() => { })
  rawIndexReady = true
}

async function mirrorTushareRows(args: {
  apiName: string
  params: Record<string, unknown>
  fields: string[]
  rows: Array<Record<string, unknown>>
}) {
  if (!TUSHARE_AUTO_MIRROR) return

  const { apiName, params, fields, rows } = args
  const now = new Date()

  try {
    await ensureRawIndexes()
    const db = await getDb()
    const endpointMeta = await findTushare11000Endpoint({ apiName }).catch(() => null)

    const ops = rows.map((row) => {
      const rowKey = buildRawRowKey(apiName, row, params)
      return {
        updateOne: {
          filter: { api_name: apiName, row_key: rowKey },
          update: {
            $set: {
              api_name: apiName,
              doc_id: endpointMeta?.doc_id,
              interface_name: endpointMeta?.interface_name,
              category: endpointMeta?.category,
              row_key: rowKey,
              data: row,
              field_names: fields,
              params_snapshot: params,
              ts_code: row.ts_code ? String(row.ts_code) : undefined,
              trade_date: row.trade_date ? String(row.trade_date) : undefined,
              end_date: row.end_date ? String(row.end_date) : undefined,
              ann_date: row.ann_date ? String(row.ann_date) : undefined,
              report_date: row.report_date ? String(row.report_date) : undefined,
              cal_date: row.cal_date ? String(row.cal_date) : undefined,
              date: row.date ? String(row.date) : undefined,
              month: row.month ? String(row.month) : undefined,
              quarter: row.quarter ? String(row.quarter) : undefined,
              exchange: row.exchange ? String(row.exchange) : undefined,
              market: row.market ? String(row.market) : undefined,
              source: 'tushare',
              fetched_at: now,
              updated_at: now
            },
            $setOnInsert: {
              first_seen_at: now,
              created_at: now
            }
          },
          upsert: true
        }
      }
    })

    if (ops.length > 0) {
      await db.collection(TUSHARE_RAW_COLLECTION).bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    await db.collection(TUSHARE_SYNC_LOG_COLLECTION).insertOne({
      api_name: apiName,
      doc_id: endpointMeta?.doc_id,
      requested_at: now,
      row_count: rows.length,
      fields,
      params,
      status: 'ok',
      source: 'tushare'
    }).catch(() => { })
  } catch {
  }
}

// ─── Tushare HTTP 客户端 ─────────────────────────────────────────────────────

async function tusharePost(
  api_name: string,
  params: Record<string, unknown>,
  fields: string[]
): Promise<Array<Record<string, unknown>>> {
  if (!TUSHARE_TOKEN) throw new Error('未配置 TUSHARE_TOKEN 环境变量')

  const normalizedApiName = normalizeTushareApiName(api_name)
  if (!normalizedApiName) throw new Error('api_name 不合法')

  const isSupported = await isTushare11000SupportedApi(normalizedApiName)
  if (!isSupported) {
    throw new Error(`接口 ${normalizedApiName} 不在 11000 积分支持清单中，已禁止调用`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  let res: Response
  try {
    res = await fetch(TUSHARE_API, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: normalizedApiName,
        token: TUSHARE_TOKEN,
        params,
        fields: fields.join(',')
      })
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new Error(`Tushare HTTP ${res.status}`)

  const json = await res.json()
  if (json.code !== 0) throw new Error(`Tushare ${normalizedApiName} 错误：${json.msg}`)

  const { fields: colNames, items } = json.data as {
    fields: string[]
    items: unknown[][]
  }
  if (!Array.isArray(items)) return []

  const rows = items.map((row) => {
    const obj: Record<string, unknown> = {}
    colNames.forEach((k, i) => {
      obj[k] = row[i] ?? null
    })
    return obj
  })

  await mirrorTushareRows({
    apiName: normalizedApiName,
    params,
    fields: colNames,
    rows
  })

  return rows
}

// ─── 公开检测函数 ─────────────────────────────────────────────────────────────

export function hasTushareLicence(): boolean {
  return TUSHARE_TOKEN.length > 0
}

// ─── 工具：写入单一列表集合 ───────────────────────────────────────────────────

async function upsertSimpleList(
  collection: string,
  rows: Array<{ symbol: string; name: string; market: string }>
): Promise<number> {
  if (rows.length === 0) return 0
  const db = await getDb()
  const now = new Date()
  const ops = rows.map((r) => ({
    updateOne: {
      filter: { symbol: r.symbol },
      update: {
        $set: { symbol: r.symbol, code: r.symbol, name: r.name, market: r.market, source: 'tushare', updated_at: now },
        $setOnInsert: { created_at: now }
      },
      upsert: true
    }
  }))
  const result = await db.collection(collection).bulkWrite(ops, { ordered: false })
  return result.upsertedCount + result.modifiedCount
}

// ═══════════════════════════════════════════════════════════════════════════════
// A 股
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchAStockList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: '' },
      ['ts_code', 'symbol', 'name', 'area', 'industry', 'fullname', 'enname', 'cnspell', 'market', 'exchange', 'curr_type',
        'list_status', 'list_date', 'delist_date', 'is_hs', 'act_name', 'act_ent_type']
    )
    const mapped = rows.map((r) => ({
      dm: fromTsCode(String(r.ts_code || '')),
      mc: String(r.name || ''),
      jys: String(r.ts_code || '').includes('.SH') ? 'SSE' : 'SZSE'
    }))
    await upsertSimpleList(
      'stock_basic_info',
      rows.map((r) => ({
        symbol: fromTsCode(String(r.ts_code || '')),
        name: String(r.name || ''),
        market: 'A股'
      }))
    )
    return { success: true, message: `已获取 ${mapped.length} 只A股`, data: mapped }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchAStockQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const today = todayYmd()
    const quoteFields = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    let row: Record<string, unknown> | undefined

    try {
      const rtRows = await tusharePost(
        'rt_k',
        { ts_code: tsCode },
        ['ts_code', 'name', 'pre_close', 'high', 'open', 'low', 'close', 'vol', 'amount', 'trade_time']
      )
      if (rtRows.length > 0) {
        const rt = rtRows[0]
        const preClose = toNumber(rt.pre_close)
        const closePrice = toNumber(rt.close)
        row = {
          ...rt,
          trade_date: today,
          change: preClose > 0 ? Number((closePrice - preClose).toFixed(4)) : 0,
          pct_chg: preClose > 0 ? Number(((closePrice - preClose) / preClose * 100).toFixed(4)) : 0
        }
      }
    } catch {
    }

    if (!row) {
      let dailyRows = await tusharePost(
        'daily',
        { ts_code: tsCode, start_date: daysAgoYmd(30), end_date: today },
        quoteFields
      )
      dailyRows = dailyRows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))
      row = dailyRows[0]
    }

    if (!row) {
      const latestRows = await tusharePost(
        'daily',
        { ts_code: tsCode, limit: 1 },
        quoteFields
      )
      row = latestRows[0]
    }

    if (!row) return { success: false, message: '无行情数据' }

    // 再查 daily_basic 获取 PE/PB/换手率等（当日或最近）
    let basicRows = await tusharePost(
      'daily_basic',
      { ts_code: tsCode, trade_date: String(row.trade_date) },
      ['ts_code', 'trade_date', 'close', 'turnover_rate', 'turnover_rate_f', 'volume_ratio', 'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm',
        'dv_ratio', 'dv_ttm', 'total_share', 'float_share', 'free_share', 'total_mv', 'circ_mv']
    )
    const basic = basicRows[0] || {}

    const tradeDate = toYmd(row.trade_date) || today
    const doc = {
      symbol,
      name: String(row.name || symbol),
      close: toNumber(row.close),
      open: toNumber(row.open),
      high: toNumber(row.high),
      low: toNumber(row.low),
      pre_close: toNumber(row.pre_close),
      pct_chg: toNumber(row.pct_chg),
      change: toNumber(row.change),
      amplitude: 0,
      amount: toNumber(row.amount),
      volume: toNumber(row.vol),
      pe: toNumber(basic.pe),
      pe_ttm: toNumber(basic.pe_ttm),
      turnover_rate: toNumber(basic.turnover_rate),
      turnover_rate_f: toNumber(basic.turnover_rate_f),
      volume_ratio: toNumber(basic.volume_ratio),
      pb: toNumber(basic.pb),
      ps: toNumber(basic.ps),
      ps_ttm: toNumber(basic.ps_ttm),
      dv_ratio: toNumber(basic.dv_ratio),
      dv_ttm: toNumber(basic.dv_ttm),
      total_share: toNumber(basic.total_share),
      float_share: toNumber(basic.float_share),
      free_share: toNumber(basic.free_share),
      total_mv: toNumber(basic.total_mv),
      circ_mv: toNumber(basic.circ_mv),
      trade_date: tradeDate,
      data_source: 'tushare_a_stock',
      updated_at: new Date(),
      created_at: new Date()
    }

    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'tushare_a_stock' },
      { $set: doc, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${symbol} 行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchAStockDaily(code: string, days = 60): Promise<{
  success: boolean
  message: string
  count: number
  stockName?: string
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN', count: 0 }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const rows = await tusharePost(
      'daily',
      { ts_code: tsCode, start_date: daysAgoYmd(days + 10), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    )
    if (rows.length === 0) return { success: false, message: '无K线数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    let upserted = 0
    for (const row of rows) {
      const tradeDate = toYmd(row.trade_date)
      if (!tradeDate) continue
      const doc = {
        symbol,
        name: symbol,
        trade_date: tradeDate,
        open: toNumber(row.open),
        close: toNumber(row.close),
        high: toNumber(row.high),
        low: toNumber(row.low),
        volume: toNumber(row.vol),
        amount: toNumber(row.amount),
        pre_close: toNumber(row.pre_close),
        pct_chg: toNumber(row.pct_chg),
        change: toNumber(row.change),
        data_source: 'tushare_a_stock_daily',
        updated_at: now
      }
      await db.collection('stock_quotes').updateOne(
        { symbol, trade_date: tradeDate, data_source: 'tushare_a_stock_daily' },
        { $set: doc, $setOnInsert: { created_at: now } },
        { upsert: true }
      )
      upserted += 1
    }
    return { success: true, message: `已获取 ${symbol} ${upserted} 天K线`, count: upserted, stockName: symbol }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误', count: 0 }
  }
}

export async function fetchAStockFinancialSummary(code: string): Promise<{
  success: boolean
  message: string
  data?: { roe: number; revenueGrowth: number; pe: number; pb: number; reportDate: string }
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const [finaRows, basicRows] = await Promise.all([
      tusharePost(
        'fina_indicator',
        { ts_code: tsCode },
        [...TUSHARE_FINA_INDICATOR_FIELDS]
      ),
      tusharePost(
        'daily_basic',
        { ts_code: tsCode, trade_date: todayYmd() },
        ['ts_code', 'trade_date', 'turnover_rate', 'turnover_rate_f', 'volume_ratio', 'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm',
          'dv_ratio', 'dv_ttm', 'total_share', 'float_share', 'free_share', 'total_mv', 'circ_mv']
      )
    ])

    const fina = finaRows[0] || {}
    const basic = basicRows[0] || {}

    const roe = toNumber(fina.roe)
    const revenueGrowth = toNumber(fina.revenue_yoy ?? fina.netprofit_yoy)
    const pe = toNumber(basic.pe)
    const pb = toNumber(basic.pb)
    const reportDate = String(fina.end_date || '')

    const db = await getDb()
    const now = new Date()
    await db.collection('financial_data').updateOne(
      { symbol, report_date: reportDate || 'latest' },
      {
        $set: {
          symbol,
          name: symbol,
          roe,
          pe,
          pe_ttm: toNumber(basic.pe_ttm),
          pb,
          ps: toNumber(basic.ps),
          ps_ttm: toNumber(basic.ps_ttm),
          dv_ratio: toNumber(basic.dv_ratio),
          dv_ttm: toNumber(basic.dv_ttm),
          turnover_rate: toNumber(basic.turnover_rate),
          turnover_rate_f: toNumber(basic.turnover_rate_f),
          volume_ratio: toNumber(basic.volume_ratio),
          total_share: toNumber(basic.total_share),
          float_share: toNumber(basic.float_share),
          free_share: toNumber(basic.free_share),
          total_mv: toNumber(basic.total_mv),
          circ_mv: toNumber(basic.circ_mv),
          revenue_yoy: revenueGrowth,
          gross_margin: toNumber(fina.grossprofit_margin),
          debt_to_assets: toNumber(fina.debt_to_assets),
          report_date: reportDate,
          data_source: 'tushare_fina_indicator',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )

    return {
      success: true,
      message: `已获取 ${symbol} 财务：ROE ${roe.toFixed(2)}%，PE ${pe.toFixed(2)}，PB ${pb.toFixed(2)}`,
      data: { roe, revenueGrowth, pe, pb, reportDate }
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchAStockProfileSummary(code: string): Promise<{
  success: boolean
  message: string
  data?: { name: string; industry: string; industryDetail: string }
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const [basicRows, companyRows] = await Promise.all([
      tusharePost(
        'stock_basic',
        { ts_code: tsCode, list_status: 'L' },
        ['ts_code', 'symbol', 'name', 'area', 'industry', 'fullname', 'enname', 'cnspell', 'market', 'exchange', 'curr_type',
          'list_status', 'list_date', 'delist_date', 'is_hs', 'act_name', 'act_ent_type']
      ),
      tusharePost(
        'stock_company',
        { ts_code: tsCode },
        ['ts_code', 'exchange', 'chairman', 'manager', 'secretary', 'reg_capital', 'setup_date', 'province', 'city', 'introduction',
          'website', 'email', 'office', 'employees', 'main_business', 'business_scope', 'com_name', 'com_id']
      )
    ])

    const basic = basicRows[0] || {}
    const company = companyRows[0] || {}

    const industry = String(basic.industry || '未知行业')
    const industryDetail = String(company.main_business || company.introduction || basic.industry || industry)
    const name = String(basic.name || symbol)

    const db = await getDb()
    const now = new Date()
    await db.collection('stock_basic_info').updateOne(
      { symbol },
      {
        $set: {
          symbol,
          code: symbol,
          name,
          market: 'A股',
          industry,
          area: String(basic.area || ''),
          industry_detail: industryDetail,
          fullname: basic.fullname ? String(basic.fullname) : undefined,
          name_en: basic.enname ? String(basic.enname) : undefined,
          cnspell: basic.cnspell ? String(basic.cnspell) : undefined,
          market_type: basic.market ? String(basic.market) : undefined,
          exchange: basic.exchange ? String(basic.exchange) : undefined,
          curr_type: basic.curr_type ? String(basic.curr_type) : undefined,
          list_status: basic.list_status ? String(basic.list_status) : undefined,
          list_date: String(basic.list_date || ''),
          delist_date: basic.delist_date ? String(basic.delist_date) : undefined,
          is_hs: basic.is_hs ? String(basic.is_hs) : undefined,
          act_name: basic.act_name ? String(basic.act_name) : undefined,
          act_ent_type: basic.act_ent_type ? String(basic.act_ent_type) : undefined,
          com_name: company.com_name ? String(company.com_name) : undefined,
          com_id: company.com_id ? String(company.com_id) : undefined,
          chairman: company.chairman ? String(company.chairman) : undefined,
          manager: company.manager ? String(company.manager) : undefined,
          secretary: company.secretary ? String(company.secretary) : undefined,
          setup_date: company.setup_date ? String(company.setup_date) : undefined,
          province: company.province ? String(company.province) : undefined,
          city: company.city ? String(company.city) : undefined,
          website: company.website ? String(company.website) : undefined,
          email: company.email ? String(company.email) : undefined,
          office: company.office ? String(company.office) : undefined,
          employees: company.employees ? toNumber(company.employees) : undefined,
          company_profile: company.introduction ? String(company.introduction) : undefined,
          business_scope: company.business_scope ? String(company.business_scope) : undefined,
          reg_capital: company.reg_capital ? toNumber(company.reg_capital) : undefined,
          source: 'tushare',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )

    return { success: true, message: `已获取 ${symbol} 公司资料`, data: { name, industry, industryDetail } }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchAStockExtendedSnapshot(code: string): Promise<{
  success: boolean
  message: string
  results: Record<string, { success: boolean; count?: number; message: string }>
}> {
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  if (!hasTushareLicence()) {
    return { success: false, message: '未配置 TUSHARE_TOKEN', results: {} }
  }

  const results: Record<string, { success: boolean; count?: number; message: string }> = {}
  const db = await getDb()
  const now = new Date()

  // 1. 分红送股
  try {
    const rows = await tusharePost(
      'dividend',
      { ts_code: tsCode },
      ['ts_code', 'end_date', 'ann_date', 'imp_ann_date', 'div_proc', 'stk_div', 'stk_bo_rate', 'stk_co_rate', 'cash_div', 'cash_div_tax',
        'record_date', 'ex_date', 'pay_date', 'div_listdate', 'base_date', 'base_share']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, announce_date: String(row.ann_date || row.end_date || '') },
        update: {
          $set: {
            symbol,
            announce_date: String(row.ann_date || ''),
            imp_announce_date: String(row.imp_ann_date || ''),
            ex_date: String(row.ex_date || ''),
            record_date: String(row.record_date || ''),
            pay_date: String(row.pay_date || ''),
            base_date: String(row.base_date || ''),
            base_share: toNumber(row.base_share),
            progress: String(row.div_proc || ''),
            cash_div: toNumber(row.cash_div),
            stk_div: toNumber(row.stk_div),
            stk_bo_rate: toNumber(row.stk_bo_rate),
            stk_co_rate: toNumber(row.stk_co_rate),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) await db.collection('stock_dividends').bulkWrite(ops, { ordered: false })
    results.dividends = { success: true, count: ops.length, message: `写入 ${ops.length} 条` }
  } catch (err) {
    results.dividends = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  // 2. 限售解禁
  try {
    const rows = await tusharePost(
      'stock_restricted',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'float_date', 'float_share', 'float_ratio', 'type']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: {
          symbol,
          unlock_date: String(row.float_date || ''),
          share_type: String(row.type || row.share_type || '')
        },
        update: {
          $set: {
            symbol,
            unlock_date: String(row.float_date || ''),
            announce_date: String(row.ann_date || ''),
            unlock_amount_wan: toNumber(row.float_share) / 10000,
            unlock_ratio: toNumber(row.float_ratio),
            holder_name: String(row.holder_name || ''),
            share_type: String(row.type || row.share_type || ''),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) await db.collection('stock_unlocks').bulkWrite(ops, { ordered: false })
    results.unlocks = { success: true, count: ops.length, message: `写入 ${ops.length} 条` }
  } catch (err) {
    results.unlocks = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  // 3. 业绩预告
  try {
    const rows = await tusharePost(
      'fina_forecast',
      { ts_code: tsCode },
      ['ts_code', 'end_date', 'type', 'net_profit_min', 'net_profit_max', 'eps_min', 'eps_max', 'reason']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: {
          symbol,
          report_date: String(row.end_date || ''),
          forecast_type: String(row.type || '')
        },
        update: {
          $set: {
            symbol,
            announce_date: String(row.end_date || ''),
            report_date: String(row.end_date || ''),
            forecast_type: String(row.type || ''),
            net_profit_min: toNumber(row.net_profit_min),
            net_profit_max: toNumber(row.net_profit_max),
            eps_min: toNumber(row.eps_min),
            eps_max: toNumber(row.eps_max),
            summary: String(row.reason || ''),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) await db.collection('stock_earnings_forecast').bulkWrite(ops, { ordered: false })
    results.earnings_forecast = { success: true, count: ops.length, message: `写入 ${ops.length} 条` }
  } catch (err) {
    results.earnings_forecast = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  // 4. 前十大流通股东
  try {
    const rows = await tusharePost(
      'top10_floatholders',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio', 'hold_float_ratio', 'hold_change', 'holder_type']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, end_date: String(row.end_date || ''), holder_name: String(row.holder_name || '') },
        update: {
          $set: {
            symbol,
            end_date: String(row.end_date || ''),
            ann_date: String(row.ann_date || ''),
            holder_name: String(row.holder_name || ''),
            hold_amount: toNumber(row.hold_amount),
            hold_ratio: toNumber(row.hold_ratio),
            hold_float_ratio: toNumber(row.hold_float_ratio),
            hold_change: toNumber(row.hold_change),
            holder_type: String(row.holder_type || ''),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) await db.collection('stock_top_holders').bulkWrite(ops, { ordered: false })
    results.instrument = { success: true, count: ops.length, message: `写入 ${ops.length} 条前十大股东` }
  } catch (err) {
    results.instrument = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  const allOk = Object.values(results).every((item) => item.success)
  return {
    success: allOk,
    message: allOk ? '扩展信息同步完成' : '扩展信息部分同步失败',
    results
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 科创板（统一用 A 股 daily 接口）
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchKcStockList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: 'SSE', market: 'STAR' },
      ['ts_code', 'symbol', 'name', 'area', 'industry', 'fullname', 'enname', 'cnspell', 'market', 'exchange', 'curr_type',
        'list_status', 'list_date', 'delist_date', 'is_hs', 'act_name', 'act_ent_type']
    )
    const mapped = rows.map((r) => ({
      dm: fromTsCode(String(r.ts_code || '')),
      mc: String(r.name || ''),
      jys: 'SSE'
    }))
    await upsertSimpleList(
      'kc_stock_list',
      rows.map((r) => ({ symbol: fromTsCode(String(r.ts_code || '')), name: String(r.name || ''), market: '科创板' }))
    )
    return { success: true, message: `已获取 ${mapped.length} 只科创股票`, data: mapped }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchKcQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return fetchAStockQuote(code)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 北交所
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchBjStockList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasTushareLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: 'BSE' },
      ['ts_code', 'symbol', 'name', 'area', 'industry', 'fullname', 'enname', 'cnspell', 'market', 'exchange', 'curr_type',
        'list_status', 'list_date', 'delist_date', 'is_hs', 'act_name', 'act_ent_type']
    )
    const mapped = rows.map((r) => ({
      dm: fromTsCode(String(r.ts_code || '')),
      mc: String(r.name || ''),
      jys: 'BSE'
    }))
    await upsertSimpleList(
      'bj_stock_list',
      rows.map((r) => ({ symbol: fromTsCode(String(r.ts_code || '')), name: String(r.name || ''), market: '京市A股' }))
    )
    return { success: true, message: `已获取 ${mapped.length} 只京市股票`, data: mapped }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return fetchAStockQuote(code)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 对外暴露 tusharePost 供 fetch-quant-data.ts 使用
// ═══════════════════════════════════════════════════════════════════════════════

export { tusharePost, toTsCode, fromTsCode, todayYmd, daysAgoYmd }
