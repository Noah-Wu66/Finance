import { getDb } from '@/lib/db'
import { inferMarketFromCode, normalizeMarketName } from '@/lib/market'

function normCode(input: string) {
  return input.trim().toUpperCase()
}

export async function searchStockBasics(keyword: string, limit = 20) {
  const db = await getDb()
  const rows = await db
    .collection('stock_basic_info')
    .find({
      $or: [
        { symbol: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } }
      ]
    })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray()

  return rows.map((row) => {
    const code = normCode(String(row.symbol || ''))
    const market = normalizeMarketName((row.market as string | undefined) || inferMarketFromCode(code))
    return {
      code,
      name: String(row.name || code),
      name_en: String(row.name_en || row.name || code),
      market,
      total_mv: Number(row.total_mv || 0),
      pe: Number(row.pe || 0),
      pb: Number(row.pb || 0),
      lot_size: Number(row.lot_size || 100),
      currency: String(row.currency || (market === '美股' ? 'USD' : market === '港股' ? 'HKD' : 'CNY')),
      industry: row.industry ? String(row.industry) : undefined,
      sector: row.sector ? String(row.sector) : undefined,
      list_date: row.list_date ? String(row.list_date) : undefined,
      updated_at: row.updated_at || row.created_at || new Date().toISOString()
    }
  })
}

export async function getStockBasicByCode(code: string) {
  const normalized = normCode(code)
  const db = await getDb()
  const row = await db.collection('stock_basic_info').findOne({ symbol: normalized })

  if (!row) return null

  const market = normalizeMarketName((row.market as string | undefined) || inferMarketFromCode(normalized))
  return {
    code: normalized,
    name: String(row.name || normalized),
    name_en: String(row.name_en || row.name || normalized),
    market,
    total_mv: Number(row.total_mv || 0),
    pe: Number(row.pe || 0),
    pb: Number(row.pb || 0),
    lot_size: Number(row.lot_size || 100),
    currency: String(row.currency || (market === '美股' ? 'USD' : market === '港股' ? 'HKD' : 'CNY')),
    industry: row.industry ? String(row.industry) : undefined,
    sector: row.sector ? String(row.sector) : undefined,
    list_date: row.list_date ? String(row.list_date) : undefined,
    updated_at: row.updated_at || row.created_at || new Date().toISOString()
  }
}

export async function getLatestQuoteByCode(code: string) {
  const normalized = normCode(code)
  const db = await getDb()
  const row = await db
    .collection('stock_quotes')
    .find({ symbol: normalized })
    .sort({ trade_date: -1 })
    .limit(1)
    .next()

  if (!row) return null

  return {
    code: normalized,
    close: Number(row.close ?? 0),
    pct_chg: Number(row.pct_chg ?? 0),
    open: Number(row.open ?? 0),
    high: Number(row.high ?? 0),
    low: Number(row.low ?? 0),
    volume: Number(row.volume ?? 0),
    amount: Number(row.amount ?? 0),
    trade_date: String(row.trade_date || ''),
    currency: String(row.currency || ''),
    turnover_rate: Number(row.turnover_rate ?? 0),
    amplitude: Number(row.amplitude ?? 0)
  }
}

export async function getDailyQuotesByCode(code: string, options?: { startDate?: string; endDate?: string; limit?: number }) {
  const normalized = normCode(code)
  const db = await getDb()
  const limit = Math.min(Math.max(options?.limit || 100, 1), 500)

  const query: Record<string, unknown> = { symbol: normalized }

  if (options?.startDate || options?.endDate) {
    const dateRange: Record<string, string> = {}
    if (options.startDate) dateRange.$gte = options.startDate
    if (options.endDate) dateRange.$lte = options.endDate
    query.trade_date = dateRange
  }

  const rows = await db
    .collection('stock_quotes')
    .find(query)
    .sort({ trade_date: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    trade_date: String(row.trade_date || ''),
    open: Number(row.open ?? 0),
    high: Number(row.high ?? 0),
    low: Number(row.low ?? 0),
    close: Number(row.close ?? 0),
    volume: Number(row.volume ?? 0),
    amount: Number(row.amount ?? 0)
  }))
}

export async function getFundamentalsByCode(code: string) {
  const normalized = normCode(code)
  const db = await getDb()
  const row = await db
    .collection('financial_data')
    .find({ symbol: normalized })
    .sort({ report_date: -1, updated_at: -1 })
    .limit(1)
    .next()

  if (!row) return null

  return {
    code: normalized,
    pe: Number(row.pe ?? 0),
    pb: Number(row.pb ?? 0),
    ps: Number(row.ps ?? 0),
    pe_ttm: Number(row.pe_ttm ?? row.pe ?? 0),
    pb_mrq: Number(row.pb_mrq ?? row.pb ?? 0),
    ps_ttm: Number(row.ps_ttm ?? row.ps ?? 0),
    roe: Number(row.roe ?? 0),
    debt_ratio: Number(row.debt_ratio ?? 0),
    total_mv: Number(row.total_mv ?? 0),
    circ_mv: Number(row.circ_mv ?? 0),
    turnover_rate: Number(row.turnover_rate ?? 0),
    volume_ratio: Number(row.volume_ratio ?? 0),
    updated_at: row.updated_at || row.created_at || new Date().toISOString()
  }
}

export async function getNewsByCode(code: string, options?: { hoursBack?: number; limit?: number }) {
  const normalized = normCode(code)
  const db = await getDb()

  const hoursBack = Math.min(Math.max(options?.hoursBack || 24, 1), 24 * 90)
  const limit = Math.min(Math.max(options?.limit || 20, 1), 200)
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const rows = await db
    .collection('news_data')
    .find({
      symbol: normalized,
      publish_time: { $gte: cutoff.toISOString() }
    })
    .sort({ publish_time: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    id: String(row._id),
    title: String(row.title || ''),
    content: row.content ? String(row.content) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    source: row.source ? String(row.source) : undefined,
    publish_time: String(row.publish_time || row.created_at || new Date().toISOString()),
    url: row.url ? String(row.url) : undefined,
    symbol: normalized,
    category: row.category ? String(row.category) : undefined,
    sentiment: row.sentiment ? String(row.sentiment) : undefined,
    importance: Number(row.importance || 0),
    data_source: row.data_source ? String(row.data_source) : undefined
  }))
}
