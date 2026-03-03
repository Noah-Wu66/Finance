import {
  isTushare11000SupportedApi,
  normalizeTushareApiName
} from '@/lib/tushare-11000'
import { TUSHARE_FINA_INDICATOR_FIELDS } from '@/lib/tushare-field-sets'
import { toNum as toNumber, toYmd } from '@/lib/utils'

const TUSHARE_TOKEN = (process.env.TUSHARE_TOKEN || '').trim()
const TUSHARE_API = 'https://api.tushare.pro'

// ─── 工具函数 ────────────────────────────────────────────────────────────────

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

  return rows
}

// ─── 公开检测函数 ─────────────────────────────────────────────────────────────

export function hasTushareLicence(): boolean {
  return TUSHARE_TOKEN.length > 0
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

    let dailyRows = await tusharePost(
      'daily',
      { ts_code: tsCode, start_date: daysAgoYmd(30), end_date: today },
      quoteFields
    )
    dailyRows = dailyRows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))
    row = dailyRows[0]

    if (!row) {
      const latestRows = await tusharePost(
        'daily',
        { ts_code: tsCode, start_date: daysAgoYmd(365), end_date: today },
        quoteFields
      )
      row = latestRows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))[0]
    }

    if (!row) return { success: false, message: '无行情数据' }

    let basicRows: Array<Record<string, unknown>> = []
    try {
      basicRows = await tusharePost(
        'daily_basic',
        { ts_code: tsCode, trade_date: String(row.trade_date) },
        ['ts_code', 'trade_date', 'close', 'turnover_rate', 'turnover_rate_f', 'volume_ratio', 'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm',
          'dv_ratio', 'dv_ttm', 'total_share', 'float_share', 'free_share', 'total_mv', 'circ_mv']
      )
    } catch (e) {
      console.error(`[fetchAStockQuote] daily_basic failed for ${tsCode}:`, e instanceof Error ? e.message : e)
    }
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
      trade_date: tradeDate
    }

    return { success: true, message: `已获取 ${symbol} 行情`, data: doc }
  } catch (err) {
    console.error(`[fetchAStockQuote] failed for ${code}:`, err instanceof Error ? err.message : err)
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
    return { success: true, message: `已获取 ${symbol} ${rows.length} 天K线`, count: rows.length, stockName: symbol }
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

    return {
      success: true,
      message: `已获取 ${symbol} 财务：ROE ${roe.toFixed(2)}%，PE ${pe.toFixed(2)}，PB ${pb.toFixed(2)}`,
      data: { roe, revenueGrowth, pe, pb, reportDate }
    }
  } catch (err) {
    console.error(`[fetchAStockFinancialSummary] failed for ${code}:`, err instanceof Error ? err.message : err)
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

    return { success: true, message: `已获取 ${symbol} 公司资料`, data: { name, industry, industryDetail } }
  } catch (err) {
    console.error(`[fetchAStockProfileSummary] failed for ${code}:`, err instanceof Error ? err.message : err)
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

  try {
    const rows = await tusharePost(
      'dividend',
      { ts_code: tsCode },
      ['ts_code', 'end_date', 'ann_date', 'imp_ann_date', 'div_proc', 'stk_div', 'stk_bo_rate', 'stk_co_rate', 'cash_div', 'cash_div_tax',
        'record_date', 'ex_date', 'pay_date', 'div_listdate', 'base_date', 'base_share']
    )
    results.dividends = { success: true, count: rows.length, message: `获取 ${rows.length} 条` }
  } catch (err) {
    results.dividends = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  try {
    const rows = await tusharePost(
      'stock_restricted',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'float_date', 'float_share', 'float_ratio', 'type']
    )
    results.unlocks = { success: true, count: rows.length, message: `获取 ${rows.length} 条` }
  } catch (err) {
    results.unlocks = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  try {
    const rows = await tusharePost(
      'fina_forecast',
      { ts_code: tsCode },
      ['ts_code', 'end_date', 'type', 'net_profit_min', 'net_profit_max', 'eps_min', 'eps_max', 'reason']
    )
    results.earnings_forecast = { success: true, count: rows.length, message: `获取 ${rows.length} 条` }
  } catch (err) {
    results.earnings_forecast = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  try {
    const rows = await tusharePost(
      'top10_floatholders',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio', 'hold_float_ratio', 'hold_change', 'holder_type']
    )
    results.instrument = { success: true, count: rows.length, message: `获取 ${rows.length} 条前十大股东` }
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
// 对外暴露 tusharePost 供 fetch-quant-data.ts 使用
// ═══════════════════════════════════════════════════════════════════════════════

export { tusharePost, toTsCode, fromTsCode, todayYmd, daysAgoYmd }
