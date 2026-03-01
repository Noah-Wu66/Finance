import { getDb } from '@/lib/db'

const TUSHARE_TOKEN = (process.env.TUSHARE_TOKEN || '').trim()
const TUSHARE_API = 'https://api.tushare.pro'

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

// ─── Tushare HTTP 客户端 ─────────────────────────────────────────────────────

async function tusharePost(
  api_name: string,
  params: Record<string, unknown>,
  fields: string[]
): Promise<Array<Record<string, unknown>>> {
  if (!TUSHARE_TOKEN) throw new Error('未配置 TUSHARE_TOKEN 环境变量')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  let res: Response
  try {
    res = await fetch(TUSHARE_API, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name,
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
  if (json.code !== 0) throw new Error(`Tushare ${api_name} 错误：${json.msg}`)

  const { fields: colNames, items } = json.data as {
    fields: string[]
    items: unknown[][]
  }
  if (!Array.isArray(items)) return []

  return items.map((row) => {
    const obj: Record<string, unknown> = {}
    colNames.forEach((k, i) => {
      obj[k] = row[i] ?? null
    })
    return obj
  })
}

// ─── 公开检测函数 ─────────────────────────────────────────────────────────────

export function hasMairuiLicence(): boolean {
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: '' },
      ['ts_code', 'symbol', 'name', 'area', 'industry', 'list_date']
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const today = todayYmd()
    // 先查当日日线，若无数据则找最近5天
    let dailyRows = await tusharePost(
      'daily',
      { ts_code: tsCode, start_date: daysAgoYmd(7), end_date: today },
      ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    )
    // 按日期倒序排，取最新一条
    dailyRows = dailyRows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))
    const row = dailyRows[0]
    if (!row) return { success: false, message: '无行情数据' }

    // 再查 daily_basic 获取 PE/PB/换手率等（当日或最近）
    let basicRows = await tusharePost(
      'daily_basic',
      { ts_code: tsCode, trade_date: String(row.trade_date) },
      ['ts_code', 'trade_date', 'pe', 'pb', 'turnover_rate', 'total_mv', 'circ_mv']
    )
    const basic = basicRows[0] || {}

    const tradeDate = toYmd(row.trade_date) || today
    const doc = {
      symbol,
      name: symbol,
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
      turnover_rate: toNumber(basic.turnover_rate),
      pb: toNumber(basic.pb),
      total_mv: toNumber(basic.total_mv),
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN', count: 0 }
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const [finaRows, basicRows] = await Promise.all([
      tusharePost(
        'fina_indicator',
        { ts_code: tsCode },
        ['ts_code', 'end_date', 'roe', 'grossprofit_margin', 'debt_to_assets', 'revenue_yoy', 'netprofit_yoy']
      ),
      tusharePost(
        'daily_basic',
        { ts_code: tsCode, trade_date: todayYmd() },
        ['ts_code', 'trade_date', 'pe', 'pb']
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
          pb,
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
  data?: { industry: string; industryDetail: string }
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const [basicRows, companyRows] = await Promise.all([
      tusharePost(
        'stock_basic',
        { ts_code: tsCode, list_status: 'L' },
        ['ts_code', 'name', 'area', 'industry', 'list_date', 'market']
      ),
      tusharePost(
        'stock_company',
        { ts_code: tsCode },
        ['ts_code', 'chairman', 'manager', 'reg_capital', 'setup_date', 'province', 'city', 'introduction', 'website', 'employees', 'main_business', 'business_scope']
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
          list_date: String(basic.list_date || ''),
          website: company.website ? String(company.website) : undefined,
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

    return { success: true, message: `已获取 ${symbol} 公司资料`, data: { industry, industryDetail } }
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
  if (!hasMairuiLicence()) {
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
      ['ts_code', 'end_date', 'ann_date', 'div_proc', 'stk_div', 'stk_bo_rate', 'stk_co_rate', 'cash_div', 'cash_div_tax', 'record_date', 'ex_date', 'pay_date', 'div_listdate']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, announce_date: String(row.ann_date || row.end_date || '') },
        update: {
          $set: {
            symbol,
            announce_date: String(row.ann_date || ''),
            ex_date: String(row.ex_date || ''),
            record_date: String(row.record_date || ''),
            pay_date: String(row.pay_date || ''),
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
      'share_float',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'float_date', 'float_share', 'float_ratio', 'holder_name', 'share_type']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, unlock_date: String(row.float_date || ''), holder_name: String(row.holder_name || '') },
        update: {
          $set: {
            symbol,
            unlock_date: String(row.float_date || ''),
            announce_date: String(row.ann_date || ''),
            unlock_amount_wan: toNumber(row.float_share) / 10000,
            unlock_ratio: toNumber(row.float_ratio),
            holder_name: String(row.holder_name || ''),
            share_type: String(row.share_type || ''),
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
      'forecast',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'type', 'p_change_min', 'p_change_max', 'net_profit_min', 'net_profit_max', 'last_parent_net', 'first_ann_date', 'summary', 'change_reason']
    )
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, announce_date: String(row.ann_date || ''), report_date: String(row.end_date || '') },
        update: {
          $set: {
            symbol,
            announce_date: String(row.ann_date || ''),
            report_date: String(row.end_date || ''),
            forecast_type: String(row.type || ''),
            p_change_min: toNumber(row.p_change_min),
            p_change_max: toNumber(row.p_change_max),
            net_profit_min: toNumber(row.net_profit_min),
            net_profit_max: toNumber(row.net_profit_max),
            summary: String(row.summary || row.change_reason || ''),
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
      ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio']
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

  // index_membership 无对应接口，跳过
  results.index_membership = { success: true, count: 0, message: '跳过（Tushare 2000积分不提供指数成份）' }

  const allOk = Object.values(results).every((item) => item.success)
  return {
    success: allOk,
    message: allOk ? '扩展信息同步完成' : '扩展信息部分同步失败',
    results
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 指数
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchIndexList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'index_basic',
      { market: 'SSE' },
      ['ts_code', 'name', 'market', 'publisher', 'category', 'list_date']
    )
    const mapped = rows.map((r) => ({
      dm: fromTsCode(String(r.ts_code || '')),
      mc: String(r.name || ''),
      jys: String(r.market || 'SSE')
    }))
    await upsertSimpleList(
      'index_list',
      rows.map((r) => ({
        symbol: fromTsCode(String(r.ts_code || '')),
        name: String(r.name || ''),
        market: '指数'
      }))
    )
    return { success: true, message: `已获取 ${mapped.length} 个指数`, data: mapped }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchIndexQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  const symbol = normalizeStockCode(code)
  const tsCode = toTsCode(symbol)
  try {
    const rows = await tusharePost(
      'index_daily',
      { ts_code: tsCode, start_date: daysAgoYmd(7), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'close', 'open', 'high', 'low', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    )
    const sorted = rows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)))
    const row = sorted[0]
    if (!row) return { success: false, message: '无指数行情数据' }

    const tradeDate = toYmd(row.trade_date) || todayYmd()
    const doc = {
      symbol,
      name: symbol,
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
      trade_date: tradeDate,
      data_source: 'tushare_index',
      updated_at: new Date(),
      created_at: new Date()
    }

    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'tushare_index' },
      { $set: doc, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${symbol} 指数行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: 'SSE', market: 'STAR' },
      ['ts_code', 'name', 'area', 'industry', 'list_date']
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

export async function fetchKcOrderBook(_code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return { success: false, message: 'Tushare 2000积分档不提供实时五档盘口' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 北交所
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchBjStockList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: 'BSE' },
      ['ts_code', 'name', 'area', 'industry', 'list_date']
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

export async function fetchBjIndexList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 TUSHARE_TOKEN' }
  try {
    const rows = await tusharePost(
      'index_basic',
      { market: 'BSE' },
      ['ts_code', 'name', 'market']
    )
    const mapped = rows.map((r) => ({
      dm: fromTsCode(String(r.ts_code || '')),
      mc: String(r.name || ''),
      jys: 'BSE'
    }))
    await upsertSimpleList(
      'bj_index_list',
      rows.map((r) => ({ symbol: fromTsCode(String(r.ts_code || '')), name: String(r.name || ''), market: '京市指数' }))
    )
    return { success: true, message: `已获取 ${mapped.length} 个京市指数`, data: mapped }
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

export async function fetchBjOrderBook(_code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return { success: false, message: 'Tushare 2000积分档不提供实时五档盘口' }
}

export async function fetchBjIndexQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return fetchIndexQuote(code)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 基金（5000积分才有 fund_daily，暂时返回不支持）
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchFundList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  return { success: false, message: 'Tushare fund_daily 需5000积分，暂不支持' }
}

export async function fetchFundQuote(_code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return { success: false, message: 'Tushare fund_daily 需5000积分，暂不支持' }
}

export async function fetchEtfFundList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  return { success: false, message: 'Tushare fund_daily 需5000积分，暂不支持' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 对外暴露 tusharePost 供 fetch-quant-data.ts 使用
// ═══════════════════════════════════════════════════════════════════════════════

export { tusharePost, toTsCode, fromTsCode, todayYmd, daysAgoYmd }
