import { getDb } from '@/lib/db'

const MAIRUI_LICENCE = (process.env.MAIRUI_LICENCE || '').trim()
const API_BASE = 'https://api.mairuiapi.com'
const BULK_API_BASE = 'https://a.mairuiapi.com'

type QueryValue = string | number | boolean | null | undefined

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

function normalizeStockCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, '')
}

function ensureCodeWithMarket(code: string): string {
  const normalized = String(code || '').trim().toUpperCase()
  if (/\.(SH|SZ|BJ)$/i.test(normalized)) return normalized
  const raw = normalizeStockCode(normalized)
  if (raw.startsWith('6') || raw.startsWith('9')) return `${raw}.SH`
  if (raw.startsWith('8') || raw.startsWith('4')) return `${raw}.BJ`
  return `${raw}.SZ`
}

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

function buildUrl(path: string, params?: Record<string, QueryValue>, useBulkHost = false): string {
  if (!MAIRUI_LICENCE) {
    throw new Error('未配置 MAIRUI_LICENCE 环境变量')
  }
  const base = useBulkHost ? BULK_API_BASE : API_BASE
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}/${MAIRUI_LICENCE}${buildQuery(params)}`
}

async function safeFetch(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(path: string, options?: {
  params?: Record<string, QueryValue>
  useBulkHost?: boolean
  timeoutMs?: number
}): Promise<any> {
  const url = buildUrl(path, options?.params, options?.useBulkHost)
  const res = await safeFetch(url, options?.timeoutMs || 15000)
  if (!res.ok) {
    throw new Error(`接口 ${path} 返回 HTTP ${res.status}`)
  }
  return await res.json()
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return [value as T]
  return []
}

export function hasMairuiLicence(): boolean {
  return MAIRUI_LICENCE.length > 0
}

export const mairuiApi = {
  hslt: {
    list: () => fetchJson('/hslt/list'),
    newStocks: () => fetchJson('/hslt/new'),
    sectorsList: () => fetchJson('/hslt/sectorslist'),
    primaryList: () => fetchJson('/hslt/primarylist'),
    sectors: (boardName: string) => fetchJson(`/hslt/sectors/${encodeURIComponent(boardName)}`),
    ztgc: (date: string) => fetchJson(`/hslt/ztgc/${date}`),
    dtgc: (date: string) => fetchJson(`/hslt/dtgc/${date}`),
    qsgc: (date: string) => fetchJson(`/hslt/qsgc/${date}`),
    cxgc: (date: string) => fetchJson(`/hslt/cxgc/${date}`),
    zbgc: (date: string) => fetchJson(`/hslt/zbgc/${date}`)
  },
  hszg: {
    list: () => fetchJson('/hszg/list'),
    gg: (conceptCode: string) => fetchJson(`/hszg/gg/${conceptCode}`),
    zg: (stockCode: string) => fetchJson(`/hszg/zg/${normalizeStockCode(stockCode)}`)
  },
  hscp: {
    gsjj: (stockCode: string) => fetchJson(`/hscp/gsjj/${normalizeStockCode(stockCode)}`),
    sszs: (stockCode: string) => fetchJson(`/hscp/sszs/${normalizeStockCode(stockCode)}`),
    ljgg: (stockCode: string) => fetchJson(`/hscp/ljgg/${normalizeStockCode(stockCode)}`),
    ljds: (stockCode: string) => fetchJson(`/hscp/ljds/${normalizeStockCode(stockCode)}`),
    ljjj: (stockCode: string) => fetchJson(`/hscp/ljjj/${normalizeStockCode(stockCode)}`),
    jnfh: (stockCode: string) => fetchJson(`/hscp/jnfh/${normalizeStockCode(stockCode)}`),
    jnzf: (stockCode: string) => fetchJson(`/hscp/jnzf/${normalizeStockCode(stockCode)}`),
    jjxs: (stockCode: string) => fetchJson(`/hscp/jjxs/${normalizeStockCode(stockCode)}`),
    jdlr: (stockCode: string) => fetchJson(`/hscp/jdlr/${normalizeStockCode(stockCode)}`),
    jdxj: (stockCode: string) => fetchJson(`/hscp/jdxj/${normalizeStockCode(stockCode)}`),
    yjyg: (stockCode: string) => fetchJson(`/hscp/yjyg/${normalizeStockCode(stockCode)}`),
    cwzb: (stockCode: string) => fetchJson(`/hscp/cwzb/${normalizeStockCode(stockCode)}`),
    sdgd: (stockCode: string) => fetchJson(`/hscp/sdgd/${normalizeStockCode(stockCode)}`),
    ltgd: (stockCode: string) => fetchJson(`/hscp/ltgd/${normalizeStockCode(stockCode)}`),
    gdbh: (stockCode: string) => fetchJson(`/hscp/gdbh/${normalizeStockCode(stockCode)}`),
    jjcg: (stockCode: string) => fetchJson(`/hscp/jjcg/${normalizeStockCode(stockCode)}`)
  },
  hsrl: {
    ssjy: (stockCode: string) => fetchJson(`/hsrl/ssjy/${normalizeStockCode(stockCode)}`),
    zbjy: (stockCode: string) => fetchJson(`/hsrl/zbjy/${normalizeStockCode(stockCode)}`),
    ssjyMore: (stockCodes: string[]) => fetchJson('/hsrl/ssjy_more', {
      params: { stock_codes: stockCodes.map((x) => normalizeStockCode(x)).join(',') }
    }),
    ssjyAll: () => fetchJson('/hsrl/ssjy/all', { useBulkHost: true }),
    realAll: () => fetchJson('/hsrl/real/all', { useBulkHost: true })
  },
  hsstock: {
    realTime: (stockCode: string) => fetchJson(`/hsstock/real/time/${normalizeStockCode(stockCode)}`),
    realFive: (stockCode: string) => fetchJson(`/hsstock/real/five/${normalizeStockCode(stockCode)}`),
    latest: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
      fetchJson(`/hsstock/latest/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params }),
    history: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
      fetchJson(`/hsstock/history/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params }),
    stopPriceHistory: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
      fetchJson(`/hsstock/stopprice/history/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
    indicators: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
      fetchJson(`/hsstock/indicators/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
    instrument: (codeWithMarket: string) => fetchJson(`/hsstock/instrument/${ensureCodeWithMarket(codeWithMarket)}`),
    historyTransaction: (stockCode: string, params?: Record<string, QueryValue>) =>
      fetchJson(`/hsstock/history/transaction/${normalizeStockCode(stockCode)}`, { params }),
    financial: {
      balance: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/balance/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      income: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/income/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      cashflow: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/cashflow/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      pershareindex: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/pershareindex/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      capital: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/capital/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      topholder: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/topholder/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      flowholder: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/flowholder/${ensureCodeWithMarket(codeWithMarket)}`, { params }),
      hm: (codeWithMarket: string, params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/financial/hm/${ensureCodeWithMarket(codeWithMarket)}`, { params })
    },
    technical: {
      macd: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/history/macd/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params }),
      ma: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/history/ma/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params }),
      boll: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/history/boll/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params }),
      kdj: (codeWithMarket: string, period = 'd', adjust = 'n', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsstock/history/kdj/${ensureCodeWithMarket(codeWithMarket)}/${period}/${adjust}`, { params })
    }
  },
  hsindex: {
    list: () => fetchJson('/hsindex/list'),
    realTime: (indexCode: string) => fetchJson(`/hsindex/real/time/${normalizeStockCode(indexCode)}`),
    latest: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
      fetchJson(`/hsindex/latest/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params }),
    history: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
      fetchJson(`/hsindex/history/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params }),
    technical: {
      macd: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsindex/history/macd/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params }),
      ma: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsindex/history/ma/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params }),
      boll: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsindex/history/boll/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params }),
      kdj: (indexCodeWithMarket: string, period = 'd', params?: Record<string, QueryValue>) =>
        fetchJson(`/hsindex/history/kdj/${ensureCodeWithMarket(indexCodeWithMarket)}/${period}`, { params })
    }
  },
  bj: {
    listAll: () => fetchJson('/bj/list/all'),
    listIndex: () => fetchJson('/bj/list/index'),
    stockRealTime: (stockCode: string) => fetchJson(`/bj/stock/real/time/${normalizeStockCode(stockCode)}`),
    stockRealFive: (stockCode: string) => fetchJson(`/bj/stock/real/five/${normalizeStockCode(stockCode)}`),
    indexRealTime: (indexCode: string) => fetchJson(`/bj/index/real/time/${normalizeStockCode(indexCode)}`)
  },
  kc: {
    listAll: () => fetchJson('/kc/list/all'),
    realTime: (stockCode: string) => fetchJson(`/kc/real/time/${normalizeStockCode(stockCode)}`),
    realFive: (stockCode: string) => fetchJson(`/kc/real/five/${normalizeStockCode(stockCode)}`)
  },
  fd: {
    listAll: () => fetchJson('/fd/list/all'),
    listEtf: () => fetchJson('/fd/list/etf'),
    realTime: (fundCode: string) => fetchJson(`/fd/real/time/${normalizeStockCode(fundCode)}`)
  }
}

async function upsertSimpleList(collection: string, rows: Array<Record<string, unknown>>, market: string) {
  if (rows.length === 0) return 0
  const db = await getDb()
  const now = new Date()
  const ops = rows.map((row) => {
    const dm = String(row.dm || '').trim().toUpperCase()
    const symbol = normalizeStockCode(dm)
    const name = String(row.mc || row.name || symbol)
    return {
      updateOne: {
        filter: { symbol },
        update: {
          $set: {
            symbol,
            code: symbol,
            name,
            jys: row.jys ? String(row.jys) : undefined,
            market,
            source: 'mairui',
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }
  })
  const result = await db.collection(collection).bulkWrite(ops, { ordered: false })
  return result.upsertedCount + result.modifiedCount
}

function pickFirstRecord<T>(input: unknown): T | null {
  const rows = asArray<T>(input)
  return rows.length > 0 ? rows[0] : null
}

export async function fetchAStockList(): Promise<{
  success: boolean
  message: string
  data?: Array<{ dm: string; mc: string; jys: string }>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.hslt.list())
    await upsertSimpleList('stock_basic_info', rows as unknown as Array<Record<string, unknown>>, 'A股')
    return { success: true, message: `已获取 ${rows.length} 只A股`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchAStockQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.hsstock.realTime(symbol))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol,
      name: String(d.mc || d.name || symbol),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      pe: toNumber(d.pe),
      turnover_rate: toNumber(d.tr),
      pb: toNumber(d.pb_ratio),
      trade_date: tradeDate,
      data_source: 'mairui_a_stock',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'mairui_a_stock' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${symbol}) 行情`, data: doc }
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE', count: 0 }
  const symbol = normalizeStockCode(code)
  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsstock.history(ensureCodeWithMarket(symbol), 'd', 'n', { lt: days }))
    if (rows.length === 0) return { success: false, message: '无K线数据', count: 0 }
    const db = await getDb()
    const now = new Date()
    let upserted = 0
    let stockName = ''
    for (const row of rows) {
      const tradeDate = toYmd(row.t)
      if (!tradeDate) continue
      const doc = {
        symbol,
        name: String(row.mc || stockName || symbol),
        trade_date: tradeDate,
        open: toNumber(row.o),
        close: toNumber(row.c),
        high: toNumber(row.h),
        low: toNumber(row.l),
        volume: toNumber(row.v),
        amount: toNumber(row.a),
        pre_close: toNumber(row.pc),
        data_source: 'mairui_a_stock_daily',
        updated_at: now
      }
      if (!stockName && row.mc) stockName = String(row.mc)
      await db.collection('stock_quotes').updateOne(
        { symbol, trade_date: tradeDate, data_source: 'mairui_a_stock_daily' },
        { $set: doc, $setOnInsert: { created_at: now } },
        { upsert: true }
      )
      upserted += 1
    }
    return { success: true, message: `已获取 ${stockName || symbol} ${upserted} 天K线`, count: upserted, stockName }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误', count: 0 }
  }
}

export async function fetchAStockFinancialSummary(code: string): Promise<{
  success: boolean
  message: string
  data?: { roe: number; revenueGrowth: number; pe: number; pb: number; reportDate: string }
}> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const [cwzbRaw, quoteRaw] = await Promise.all([
      mairuiApi.hscp.cwzb(symbol),
      mairuiApi.hsstock.realTime(symbol)
    ])
    const cwzb = pickFirstRecord<Record<string, unknown>>(cwzbRaw)
    const quote = pickFirstRecord<Record<string, unknown>>(quoteRaw)
    if (!cwzb && !quote) return { success: false, message: '无财务数据' }

    const roe = toNumber(cwzb?.jzsy ?? cwzb?.jqjz ?? cwzb?.jzbc)
    const revenueGrowth = toNumber(cwzb?.zysr ?? cwzb?.jlzz)
    const pe = toNumber(quote?.pe)
    const pb = toNumber(quote?.pb_ratio)
    const reportDate = String(cwzb?.date || '')
    const now = new Date()

    const db = await getDb()
    await db.collection('financial_data').updateOne(
      { symbol, report_date: reportDate || 'latest' },
      {
        $set: {
          symbol,
          name: String(quote?.mc || symbol),
          roe,
          pe,
          pb,
          revenue_yoy: revenueGrowth,
          report_date: reportDate,
          data_source: 'mairui_hscp_cwzb',
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
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const [profileRaw, conceptRaw] = await Promise.all([
      mairuiApi.hscp.gsjj(symbol),
      mairuiApi.hszg.zg(symbol)
    ])
    const profile = pickFirstRecord<Record<string, unknown>>(profileRaw)
    const concepts = asArray<Record<string, unknown>>(conceptRaw)

    const relatedNames = concepts.map((item) => String(item.name || '')).filter(Boolean)
    const industryByConcept = relatedNames.find((name) => name.includes('行业')) || relatedNames[0] || ''
    const idea = String(profile?.idea || '')
    const industry = industryByConcept || idea.split(',')[0] || '未知行业'
    const industryDetail = idea || industry

    const now = new Date()
    const db = await getDb()
    await db.collection('stock_basic_info').updateOne(
      { symbol },
      {
        $set: {
          symbol,
          code: symbol,
          name: String(profile?.name || symbol),
          market: String(profile?.market || 'A股'),
          industry,
          industry_detail: industryDetail,
          concepts: relatedNames,
          list_date: profile?.ldate ? String(profile.ldate) : undefined,
          website: profile?.site ? String(profile.site) : undefined,
          company_profile: profile?.desc ? String(profile.desc) : undefined,
          business_scope: profile?.bscope ? String(profile.bscope) : undefined,
          source: 'mairui',
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
  if (!hasMairuiLicence()) {
    return {
      success: false,
      message: '未配置 MAIRUI_LICENCE',
      results: {}
    }
  }

  const results: Record<string, { success: boolean; count?: number; message: string }> = {}
  const db = await getDb()
  const now = new Date()

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.sszs(symbol))
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, index_code: String(row.dm || ''), in_date: String(row.ind || '') },
        update: {
          $set: {
            symbol,
            index_code: String(row.dm || ''),
            index_name: String(row.mc || ''),
            in_date: String(row.ind || ''),
            out_date: String(row.outd || ''),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) await db.collection('stock_index_membership').bulkWrite(ops, { ordered: false })
    results.index_membership = { success: true, count: ops.length, message: `写入 ${ops.length} 条` }
  } catch (err) {
    results.index_membership = { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.jnfh(symbol))
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, announce_date: String(row.sdate || '') },
        update: {
          $set: {
            symbol,
            announce_date: String(row.sdate || ''),
            give: toNumber(row.give),
            change: toNumber(row.change),
            send: toNumber(row.send),
            progress: String(row.line || ''),
            ex_date: String(row.cdate || ''),
            record_date: String(row.edate || ''),
            listed_date: String(row.hdate || ''),
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

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.jjxs(symbol))
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, unlock_date: String(row.rdate || '') },
        update: {
          $set: {
            symbol,
            unlock_date: String(row.rdate || ''),
            unlock_amount_wan: toNumber(row.ramount),
            unlock_value_yi: toNumber(row.rprice),
            batch: toNumber(row.batch),
            announce_date: String(row.pdate || ''),
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

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.yjyg(symbol))
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { symbol, announce_date: String(row.pdate || ''), report_date: String(row.rdate || '') },
        update: {
          $set: {
            symbol,
            announce_date: String(row.pdate || ''),
            report_date: String(row.rdate || ''),
            forecast_type: String(row.type || ''),
            summary: String(row.abs || ''),
            eps_last_year: toNumber(row.old),
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

  try {
    const instrument = pickFirstRecord<Record<string, unknown>>(await mairuiApi.hsstock.instrument(ensureCodeWithMarket(symbol)))
    if (!instrument) {
      results.instrument = { success: false, message: '无基础信息' }
    } else {
      await db.collection('stock_instrument').updateOne(
        { symbol },
        {
          $set: {
            symbol,
            market_code: String(instrument.ei || ''),
            stock_code: String(instrument.ii || symbol),
            name: String(instrument.name || symbol),
            ipo_date: String(instrument.od || ''),
            pre_close: toNumber(instrument.pc),
            limit_up: toNumber(instrument.up),
            limit_down: toNumber(instrument.dp),
            float_shares: toNumber(instrument.fv),
            total_shares: toNumber(instrument.tv),
            suspend_flag: toNumber(instrument.is),
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        { upsert: true }
      )
      results.instrument = { success: true, count: 1, message: '写入 1 条' }
    }
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

export async function fetchIndexList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.hsindex.list())
    await upsertSimpleList('index_list', rows as unknown as Array<Record<string, unknown>>, '指数')
    return { success: true, message: `已获取 ${rows.length} 个指数`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchIndexQuote(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const indexCode = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.hsindex.realTime(indexCode))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol: indexCode,
      name: String(d.mc || indexCode),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      trade_date: tradeDate,
      data_source: 'mairui_index',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol: indexCode, trade_date: tradeDate, data_source: 'mairui_index' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${indexCode}) 指数行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchKcStockList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.kc.listAll())
    await upsertSimpleList('kc_stock_list', rows as unknown as Array<Record<string, unknown>>, '科创板')
    return { success: true, message: `已获取 ${rows.length} 只科创股票`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchKcQuote(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.kc.realTime(symbol))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol,
      name: String(d.mc || symbol),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      pe: toNumber(d.pe),
      turnover_rate: toNumber(d.tr),
      pb: toNumber(d.pb_ratio),
      trade_date: tradeDate,
      data_source: 'mairui_kc',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'mairui_kc' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${symbol}) 科创行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchKcOrderBook(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const data = await mairuiApi.kc.realFive(code)
    return { success: true, message: `已获取 ${normalizeStockCode(code)} 五档盘口`, data }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjStockList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.bj.listAll())
    await upsertSimpleList('bj_stock_list', rows as unknown as Array<Record<string, unknown>>, '京市A股')
    return { success: true, message: `已获取 ${rows.length} 只京市股票`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjIndexList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.bj.listIndex())
    await upsertSimpleList('bj_index_list', rows as unknown as Array<Record<string, unknown>>, '京市指数')
    return { success: true, message: `已获取 ${rows.length} 个京市指数`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjQuote(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.bj.stockRealTime(symbol))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol,
      name: String(d.mc || symbol),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      pe: toNumber(d.pe),
      turnover_rate: toNumber(d.tr),
      pb: toNumber(d.pb_ratio),
      trade_date: tradeDate,
      data_source: 'mairui_bj',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'mairui_bj' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${symbol}) 京市行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjOrderBook(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const data = await mairuiApi.bj.stockRealFive(code)
    return { success: true, message: `已获取 ${normalizeStockCode(code)} 五档盘口`, data }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchBjIndexQuote(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.bj.indexRealTime(symbol))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol,
      name: String(d.mc || symbol),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      pe: toNumber(d.pe),
      turnover_rate: toNumber(d.tr),
      pb: toNumber(d.pb_ratio),
      trade_date: tradeDate,
      data_source: 'mairui_bj_index',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'mairui_bj_index' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${symbol}) 京市指数行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchFundList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.fd.listAll())
    await upsertSimpleList('fund_list', rows as unknown as Array<Record<string, unknown>>, '基金')
    return { success: true, message: `已获取 ${rows.length} 只基金`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchFundQuote(code: string): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  const symbol = normalizeStockCode(code)
  try {
    const d = pickFirstRecord<Record<string, unknown>>(await mairuiApi.fd.realTime(symbol))
    if (!d) return { success: false, message: '无数据' }
    const now = new Date()
    const tradeDate = toYmd(d.t) || toYmd(now)
    const doc = {
      symbol,
      name: String(d.mc || symbol),
      close: toNumber(d.p),
      open: toNumber(d.o),
      high: toNumber(d.h),
      low: toNumber(d.l),
      pre_close: toNumber(d.yc),
      pct_chg: toNumber(d.pc),
      change: toNumber(d.ud),
      amplitude: toNumber(d.zf),
      amount: toNumber(d.cje),
      volume: toNumber(d.v),
      pe: toNumber(d.pe),
      turnover_rate: toNumber(d.tr),
      pb: toNumber(d.pb_ratio),
      trade_date: tradeDate,
      data_source: 'mairui_fund',
      updated_at: now,
      created_at: now
    }
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol, trade_date: tradeDate, data_source: 'mairui_fund' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )
    return { success: true, message: `已获取 ${doc.name}(${symbol}) 基金行情`, data: doc }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}

export async function fetchEtfFundList(): Promise<{ success: boolean; message: string; data?: Array<{ dm: string; mc: string; jys: string }> }> {
  if (!hasMairuiLicence()) return { success: false, message: '未配置 MAIRUI_LICENCE' }
  try {
    const rows = asArray<{ dm: string; mc: string; jys: string }>(await mairuiApi.fd.listEtf())
    await upsertSimpleList('etf_fund_list', rows as unknown as Array<Record<string, unknown>>, 'ETF基金')
    return { success: true, message: `已获取 ${rows.length} 只ETF基金`, data: rows }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误' }
  }
}
