import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { fetchAllQuantData } from '@/lib/fetch-quant-data'
import { inferMarketFromCode } from '@/lib/market'
import { createOperationLog } from '@/lib/operation-logs'
import { analyzeWithAI, isAIEnabled } from '@/lib/ai-client'
import { tusharePost, toTsCode, hasTushareLicence, todayYmd, daysAgoYmd } from '@/lib/tushare-data'

const EXEC_COLLECTION = 'web_executions'
const REPORT_COLLECTION = 'analysis_reports'
const BATCH_COLLECTION = 'web_batches'
const CALENDAR_COLLECTION = 'trading_calendar'
const INDEX_COLLECTION = 'index_daily'
const FUND_FLOW_COLLECTION = 'stock_fund_flow'
const FINANCIAL_ENHANCED_COLLECTION = 'financial_enhanced'
const NEWS_SENTIMENT_COLLECTION = 'news_sentiment'
const ADJUST_FACTOR_COLLECTION = 'stock_adjust_factors'
const CORPORATE_ACTION_COLLECTION = 'stock_corporate_actions'
const INDUSTRY_AGG_COLLECTION = 'industry_aggregation'
const EARNINGS_EXPECT_COLLECTION = 'earnings_expectation'
const DATA_QUALITY_COLLECTION = 'data_quality'
const QUANT_AUTO_FETCH_LOG_COLLECTION = 'quant_auto_fetch_logs'
const NORTHBOUND_FLOW_COLLECTION = 'northbound_flow'
const MARGIN_TRADING_COLLECTION = 'margin_trading'
const DRAGON_TIGER_COLLECTION = 'dragon_tiger'
const INSTITUTION_HOLDING_COLLECTION = 'institution_holding'

const STALE_TIMEOUT_MS = 150 * 1000

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

export interface ExecutionDoc {
  _id?: ObjectId
  user_id: string
  user_email: string
  type: 'analysis'
  symbol: string
  market: string
  depth: '全面'
  status: ExecutionStatus
  step: number
  total_steps: number
  progress: number
  context: Record<string, unknown>
  result?: Record<string, unknown>
  report_id?: string
  created_at: Date
  updated_at: Date
  stopped_reason?: string
}

interface BatchDoc {
  _id?: ObjectId
  user_id: string
  title: string
  symbols: string[]
  execution_ids: string[]
  created_at: Date
  updated_at: Date
}

interface NotificationDoc {
  _id?: ObjectId
  user_id: string
  type: 'analysis' | 'alert' | 'system'
  title: string
  content?: string
  link?: string
  source?: string
  status: 'unread' | 'read'
  created_at: Date
}

async function createNotification(input: {
  userId: string
  type: 'analysis' | 'alert' | 'system'
  title: string
  content?: string
  link?: string
  source?: string
}) {
  const db = await getDb()
  const notifications = db.collection<NotificationDoc>('notifications')
  await notifications.insertOne({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    content: input.content,
    link: input.link,
    source: input.source || 'analysis',
    status: 'unread',
    created_at: new Date()
  } as Omit<NotificationDoc, '_id'>)
}

async function createNotificationSafe(input: {
  userId: string
  type: 'analysis' | 'alert' | 'system'
  title: string
  content?: string
  link?: string
  source?: string
}) {
  try {
    await createNotification(input)
  } catch {
  }
}

async function createOperationLogSafe(input: {
  userId: string
  userEmail: string
  actionType: string
  action: string
  details?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
}) {
  try {
    await createOperationLog({
      userId: input.userId,
      userEmail: input.userEmail,
      actionType: input.actionType,
      action: input.action,
      details: input.details,
      success: input.success,
      errorMessage: input.errorMessage
    })
  } catch {
  }
}

function sanitizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
}

async function loadStockBasic(symbol: string) {
  const db = await getDb()
  const doc = await db.collection('stock_basic_info').findOne({ symbol })

  return {
    symbol,
    name: (doc?.name as string | undefined) || symbol,
    industry: (doc?.industry as string | undefined) || '未知行业'
  }
}

async function loadQuotePack(symbol: string) {
  const tsCode = toTsCode(symbol)

  if (hasTushareLicence()) {
    try {
      const rows = await tusharePost(
        'daily',
        { ts_code: tsCode, start_date: daysAgoYmd(10), end_date: todayYmd() },
        ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
      )
      if (rows.length > 0) {
        const sorted = [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
        const latest = sorted[0]
        const latestClose = toNumber(latest.close)
        const preClose = toNumber(latest.pre_close)
        const changePct = toNumber(latest.pct_chg)
        if (latestClose > 0) {
          return {
            latestClose,
            prevClose: preClose,
            changePct,
            samples: rows.length,
            source: 'tushare' as const
          }
        }
      }
    } catch {
    }
  }

  const db = await getDb()
  const rows = await db
    .collection('stock_quotes')
    .find({
      symbol,
      data_source: {
        $in: ['tushare_a_stock_daily', 'tushare_a_stock']
      }
    })
    .sort({ trade_date: -1 })
    .limit(2)
    .toArray()

  if (rows.length > 0) {
    const latestClose = Number(rows[0].close ?? 0)
    const preClose = rows.length >= 2 ? Number(rows[1].close ?? latestClose) : Number(rows[0].pre_close ?? latestClose)
    const changePct = preClose > 0 ? ((latestClose - preClose) / preClose) * 100 : 0

    return {
      latestClose,
      prevClose: preClose,
      changePct,
      samples: rows.length,
      source: 'database' as const
    }
  }

  return {
    latestClose: 0,
    prevClose: 0,
    changePct: 0,
    samples: 0,
    source: 'none' as const
  }
}

async function loadFundamentals(symbol: string) {
  const db = await getDb()

  const basicDoc = await db.collection('stock_basic_info').findOne({ symbol })
  const finaDoc = await db.collection('financial_data').findOne(
    { symbol },
    { sort: { report_date: -1, updated_at: -1 } }
  )

  const roe = Number(basicDoc?.roe ?? finaDoc?.roe ?? 0)
  const pe = Number(basicDoc?.pe ?? finaDoc?.pe ?? 0)
  const pb = Number(basicDoc?.pb ?? finaDoc?.pb ?? 0)
  const revenueGrowth = Number(basicDoc?.revenue_yoy ?? finaDoc?.revenue_yoy ?? 0)

  return { roe, pe, pb, revenueGrowth }
}

function makeDecision(changePct: number, roe: number, pe: number, pb: number) {
  let score = 0

  // 涨跌幅
  if (changePct > 2) score += 1
  if (changePct < -2) score -= 1

  // ROE（如果有数据）
  if (roe > 10) score += 1
  if (roe > 0 && roe < 5) score -= 1

  // PE 市盈率
  if (pe > 0 && pe < 25) score += 1
  if (pe >= 40) score -= 1

  // PB 市净率
  if (pb > 0 && pb < 3) score += 1
  if (pb >= 8) score -= 1

  if (score >= 2) {
    return {
      action: '偏多',
      risk: '中',
      confidence: 78
    }
  }

  if (score <= -1) {
    return {
      action: '偏空',
      risk: '中高',
      confidence: 64
    }
  }

  return {
    action: '观望',
    risk: '中',
    confidence: 70
  }
}

async function loadKlineHistory(symbol: string, limit = 60) {
  const db = await getDb()
  const rows = await db
    .collection('stock_quotes')
    .find({
      symbol,
      data_source: {
        $in: ['tushare_a_stock_daily', 'tushare_a_stock']
      }
    })
    .sort({ trade_date: -1 })
    .limit(limit)
    .toArray()

  return rows
    .map((r) => ({
      time: String(r.trade_date || ''),
      open: Number(r.open ?? 0),
      high: Number(r.high ?? 0),
      low: Number(r.low ?? 0),
      close: Number(r.close ?? 0),
      volume: Number(r.volume ?? 0)
    }))
    .reverse()
}

interface IndexDailyItem {
  index_code: string
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  pct_chg: number
}

interface FundFlowItem {
  symbol: string
  trade_date: string
  main_inflow: number
  northbound_net?: number
  margin_balance?: number
  short_balance?: number
}

interface FinancialEnhancedItem {
  symbol: string
  report_period: string
  profit_yoy?: number
  gross_margin?: number
  debt_to_asset?: number
  operating_cashflow?: number
  ocf_to_profit?: number
}

interface NewsSentimentItem {
  symbol: string
  publish_time: string
  sentiment_score: number
  relevance_score: number
  dedup_id: string
}

interface AdjustFactorItem {
  symbol: string
  ex_dividend_date: string
  adj_factor?: number
  fore_adj_factor?: number
  back_adj_factor?: number
}

interface CorporateActionItem {
  symbol: string
  action_type: string
  ex_dividend_date: string
  cash_dividend_ps?: number
  bonus_share_ps?: number
  reserve_to_stock_ps?: number
  rights_issue_price?: number
}

interface IndustryAggregationItem {
  industry_name: string
  trade_date: string
  industry_main_inflow?: number
  industry_sentiment?: number
  industry_heat?: number
}

interface EarningsExpectationItem {
  symbol: string
  announce_date: string
  source_type: string
  forecast_type?: string
  profit_change_pct?: number
  eps?: number
  revenue?: number
  net_profit?: number
}

interface DataQualityItem {
  dataset: string
  symbol?: string
  as_of: string
  latency_sec?: number
  source?: string
  quality_flag?: string
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normalizeYmd(raw: unknown): string {
  if (typeof raw !== 'string' && typeof raw !== 'number') return ''
  const source = String(raw).trim()
  if (!source) return ''

  const compact = source.replace(/[^0-9]/g, '')
  if (compact.length >= 8) {
    return compact.slice(0, 8)
  }

  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear().toString()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatYmd(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

function getCalendarMarketCandidates(market: string): string[] {
  return ['SSE', 'SZSE', 'CN', 'A股']
}

function getIndexCandidatesByMarket(market: string): string[] {
  return ['000300', '000001', '399001', '399006']
}

function ymdDaysAgo(days: number): string {
  const now = new Date()
  now.setDate(now.getDate() - days)
  const y = now.getFullYear().toString()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function sleepMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function detectMissingEnhancedDatasets(params: {
  symbol: string
  market: string
  industry: string
  lastKlineDate: string
}): Promise<string[]> {
  const { symbol, market, industry, lastKlineDate } = params
  const db = await getDb()
  const missing: string[] = []
  const lastDate = normalizeYmd(lastKlineDate)

  const [
    tradingDaysCount,
    indexCount,
    fundFlowCount,
    financialCount,
    sentimentCount,
    adjustFactorCount,
    corporateActionCount,
    industryAggCount,
    earningsCount
  ] = await Promise.all([
    db.collection(CALENDAR_COLLECTION).countDocuments({
      market: { $in: getCalendarMarketCandidates(market) },
      date: { $gt: lastDate || ymdDaysAgo(1) },
      is_trading_day: { $in: [1, '1', true] }
    }, { limit: 10 }),
    db.collection(INDEX_COLLECTION).countDocuments({
      index_code: { $in: getIndexCandidatesByMarket(market) },
      trade_date: { $gte: ymdDaysAgo(120), $lte: lastDate || ymdDaysAgo(0) }
    }, { limit: 50 }),
    db.collection(FUND_FLOW_COLLECTION).countDocuments({
      symbol,
      trade_date: { $gte: ymdDaysAgo(45) }
    }, { limit: 20 }),
    db.collection(FINANCIAL_ENHANCED_COLLECTION).countDocuments({ symbol }, { limit: 1 }),
    db.collection(NEWS_SENTIMENT_COLLECTION).countDocuments({ symbol }, { limit: 20 }),
    db.collection(ADJUST_FACTOR_COLLECTION).countDocuments({ symbol }, { limit: 10 }),
    db.collection(CORPORATE_ACTION_COLLECTION).countDocuments({ symbol }, { limit: 10 }),
    industry
      ? db.collection(INDUSTRY_AGG_COLLECTION).countDocuments({ industry_name: industry }, { limit: 10 })
      : Promise.resolve(0),
    db.collection(EARNINGS_EXPECT_COLLECTION).countDocuments({ symbol }, { limit: 10 })
  ])

  if (tradingDaysCount < 10) missing.push('trading_calendar')
  if (indexCount < 20) missing.push('index_daily')
  if (fundFlowCount < 8) missing.push('stock_fund_flow')
  if (financialCount < 1) missing.push('financial_enhanced')
  if (sentimentCount < 5) missing.push('news_sentiment')
  if (adjustFactorCount < 3) missing.push('stock_adjust_factors')
  if (corporateActionCount < 2) missing.push('stock_corporate_actions')
  if (industry && industryAggCount < 1) missing.push('industry_aggregation')
  if (earningsCount < 1) missing.push('earnings_expectation')

  return missing
}

async function triggerQuantAutoFetchIfNeeded(params: {
  symbol: string
  market: string
  industry: string
  missingDatasets: string[]
  userId: string
}): Promise<{ triggered: boolean; reason: string; missing: string[] }> {
  const { symbol, market, industry, missingDatasets, userId } = params
  if (missingDatasets.length === 0) {
    return { triggered: false, reason: 'all-ready', missing: [] }
  }

  const webhook = process.env.QUANT_AUTO_FETCH_URL
  if (!webhook) {
    return { triggered: false, reason: 'no-webhook', missing: missingDatasets }
  }

  const db = await getDb()
  const now = new Date()
  const cooldownMs = 15 * 60 * 1000
  const key = `${userId}:${symbol}`
  const lock = await db.collection(QUANT_AUTO_FETCH_LOG_COLLECTION).findOne({ key })
  const lastTriggerAt = lock?.last_trigger_at instanceof Date ? lock.last_trigger_at : null
  if (lastTriggerAt && now.getTime() - lastTriggerAt.getTime() < cooldownMs) {
    return { triggered: false, reason: 'cooldown', missing: missingDatasets }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        market,
        industry,
        datasets: missingDatasets,
        trigger: 'analysis_step_5',
        triggered_at: now.toISOString()
      }),
      signal: controller.signal
    })

    const ok = response.ok
    await db.collection(QUANT_AUTO_FETCH_LOG_COLLECTION).updateOne(
      { key },
      {
        $set: {
          key,
          user_id: userId,
          symbol,
          market,
          industry,
          last_trigger_at: now,
          last_missing: missingDatasets,
          last_status: ok ? 'ok' : `http_${response.status}`,
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )

    return {
      triggered: ok,
      reason: ok ? 'triggered' : `http_${response.status}`,
      missing: missingDatasets
    }
  } catch {
    await db.collection(QUANT_AUTO_FETCH_LOG_COLLECTION).updateOne(
      { key },
      {
        $set: {
          key,
          user_id: userId,
          symbol,
          market,
          industry,
          last_trigger_at: now,
          last_missing: missingDatasets,
          last_status: 'error',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )
    return { triggered: false, reason: 'error', missing: missingDatasets }
  } finally {
    clearTimeout(timeoutId)
  }
}

function fallbackTradingDays(lastDate: string, count: number): string[] {
  const normalized = normalizeYmd(lastDate)
  const base = normalized ? new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00+08:00`) : new Date()
  const days: string[] = []
  const cursor = new Date(base)
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1)
    const day = cursor.getDay()
    if (day === 0 || day === 6) continue
    const y = cursor.getFullYear().toString()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    days.push(`${y}${m}${d}`)
  }
  return days
}

async function loadNextTradingDays(lastDate: string, market: string, count = 10): Promise<string[]> {
  const db = await getDb()
  const startDate = normalizeYmd(lastDate)
  if (!startDate) {
    return fallbackTradingDays(lastDate, count)
  }
  const formattedStart = formatYmd(startDate)

  const rows = await db
    .collection(CALENDAR_COLLECTION)
    .find({
      market: { $in: getCalendarMarketCandidates(market) },
      $or: [
        { date: { $gt: startDate } },
        { date: { $gt: formattedStart } }
      ],
      is_trading_day: { $in: [1, '1', true] }
    })
    .sort({ date: 1 })
    .limit(count)
    .toArray()

  const days = rows
    .map((row) => normalizeYmd(row.date))
    .filter((value) => value.length === 8)

  if (days.length >= count) return days
  const fallback = fallbackTradingDays(lastDate, count)
  const merged = [...days]
  for (const item of fallback) {
    if (!merged.includes(item)) merged.push(item)
    if (merged.length >= count) break
  }
  return merged.slice(0, count)
}

async function loadIndexBenchmarks(lastDate: string, market: string, limit = 60): Promise<IndexDailyItem[]> {
  const indexTsCodes: Array<{ code: string; tsCode: string }> = [
    { code: '000300', tsCode: '000300.SH' },
    { code: '000016', tsCode: '000016.SH' },
    { code: '399006', tsCode: '399006.SZ' },
    { code: '000905', tsCode: '000905.SH' }
  ]

  if (hasTushareLicence()) {
    try {
      const allRows: IndexDailyItem[] = []
      const endDate = todayYmd()
      const startDate = daysAgoYmd(limit + 20)
      for (const idx of indexTsCodes) {
        try {
          const rows = await tusharePost(
            'index_daily',
            { ts_code: idx.tsCode, start_date: startDate, end_date: endDate },
            ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount', 'pct_chg']
          )
          for (const row of rows) {
            allRows.push({
              index_code: idx.code,
              trade_date: normalizeYmd(row.trade_date),
              open: toNumber(row.open),
              high: toNumber(row.high),
              low: toNumber(row.low),
              close: toNumber(row.close),
              volume: toNumber(row.vol),
              pct_chg: toNumber(row.pct_chg)
            })
          }
        } catch {
        }
      }
      if (allRows.length > 0) {
        return allRows
          .filter((row) => row.index_code && row.trade_date)
          .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
      }
    } catch {
    }
  }

  const db = await getDb()
  const normalizedDate = normalizeYmd(lastDate)
  const formattedDate = formatYmd(normalizedDate)
  const rows = await db
    .collection(INDEX_COLLECTION)
    .find({
      index_code: { $in: getIndexCandidatesByMarket(market) },
      ...(normalizedDate
        ? {
          $or: [
            { trade_date: { $lte: normalizedDate } },
            { trade_date: { $lte: formattedDate } }
          ]
        }
        : {})
    })
    .sort({ trade_date: -1 })
    .limit(limit * 4)
    .toArray()

  const mapped = rows.map((row) => ({
    index_code: String(row.index_code || ''),
    trade_date: normalizeYmd(row.trade_date),
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
    volume: toNumber(row.volume),
    pct_chg: toNumber(row.pct_chg)
  }))

  return mapped
    .filter((row) => row.index_code && row.trade_date)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
}

async function loadFundFlow(symbol: string, limit = 30): Promise<FundFlowItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(FUND_FLOW_COLLECTION)
    .find({ symbol })
    .sort({ trade_date: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    trade_date: normalizeYmd(row.trade_date),
    main_inflow: toNumber(row.main_inflow),
    northbound_net: row.northbound_net == null ? undefined : toNumber(row.northbound_net),
    margin_balance: row.margin_balance == null ? undefined : toNumber(row.margin_balance),
    short_balance: row.short_balance == null ? undefined : toNumber(row.short_balance)
  }))
}

async function loadEnhancedFinancial(symbol: string): Promise<FinancialEnhancedItem | null> {
  const db = await getDb()
  const row = await db
    .collection(FINANCIAL_ENHANCED_COLLECTION)
    .find({ symbol })
    .sort({ report_period: -1, updated_at: -1, created_at: -1 })
    .limit(1)
    .next()

  if (!row) return null

  return {
    symbol,
    report_period: String(row.report_period || row.report_date || ''),
    profit_yoy: row.profit_yoy == null ? undefined : toNumber(row.profit_yoy),
    gross_margin: row.gross_margin == null ? undefined : toNumber(row.gross_margin),
    debt_to_asset: row.debt_to_asset == null ? undefined : toNumber(row.debt_to_asset),
    operating_cashflow: row.operating_cashflow == null ? undefined : toNumber(row.operating_cashflow),
    ocf_to_profit: row.ocf_to_profit == null ? undefined : toNumber(row.ocf_to_profit)
  }
}

async function loadNewsSentiment(symbol: string, limit = 50): Promise<NewsSentimentItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(NEWS_SENTIMENT_COLLECTION)
    .find({ symbol })
    .sort({ publish_time: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    publish_time: String(row.publish_time || row.created_at || ''),
    sentiment_score: toNumber(row.sentiment_score),
    relevance_score: toNumber(row.relevance_score),
    dedup_id: String(row.dedup_id || '')
  }))
}

async function loadAdjustFactors(symbol: string, limit = 30): Promise<AdjustFactorItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(ADJUST_FACTOR_COLLECTION)
    .find({ symbol })
    .sort({ ex_dividend_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    ex_dividend_date: normalizeYmd(row.ex_dividend_date),
    adj_factor: row.adj_factor == null ? undefined : toNumber(row.adj_factor),
    fore_adj_factor: row.fore_adj_factor == null ? undefined : toNumber(row.fore_adj_factor),
    back_adj_factor: row.back_adj_factor == null ? undefined : toNumber(row.back_adj_factor)
  }))
}

async function loadCorporateActions(symbol: string, limit = 30): Promise<CorporateActionItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(CORPORATE_ACTION_COLLECTION)
    .find({ symbol })
    .sort({ ex_dividend_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    action_type: String(row.action_type || 'dividend'),
    ex_dividend_date: normalizeYmd(row.ex_dividend_date),
    cash_dividend_ps: row.cash_dividend_ps == null ? undefined : toNumber(row.cash_dividend_ps),
    bonus_share_ps: row.bonus_share_ps == null ? undefined : toNumber(row.bonus_share_ps),
    reserve_to_stock_ps: row.reserve_to_stock_ps == null ? undefined : toNumber(row.reserve_to_stock_ps),
    rights_issue_price: row.rights_issue_price == null ? undefined : toNumber(row.rights_issue_price)
  }))
}

async function loadIndustryAggregation(industry: string, limit = 20): Promise<IndustryAggregationItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(INDUSTRY_AGG_COLLECTION)
    .find({ industry_name: industry })
    .sort({ trade_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    industry_name: String(row.industry_name || industry),
    trade_date: normalizeYmd(row.trade_date) || String(row.trade_date || 'latest'),
    industry_main_inflow: row.industry_main_inflow == null ? undefined : toNumber(row.industry_main_inflow),
    industry_sentiment: row.industry_sentiment == null ? undefined : toNumber(row.industry_sentiment),
    industry_heat: row.industry_heat == null ? undefined : toNumber(row.industry_heat)
  }))
}

async function loadEarningsExpectation(symbol: string, limit = 20): Promise<EarningsExpectationItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(EARNINGS_EXPECT_COLLECTION)
    .find({ symbol })
    .sort({ announce_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    announce_date: normalizeYmd(row.announce_date) || String(row.announce_date || 'latest'),
    source_type: String(row.source_type || 'forecast'),
    forecast_type: row.forecast_type ? String(row.forecast_type) : undefined,
    profit_change_pct: row.profit_change_pct == null ? undefined : toNumber(row.profit_change_pct),
    eps: row.eps == null ? undefined : toNumber(row.eps),
    revenue: row.revenue == null ? undefined : toNumber(row.revenue),
    net_profit: row.net_profit == null ? undefined : toNumber(row.net_profit)
  }))
}

async function loadDataQualitySnapshot(symbol: string, limit = 30): Promise<DataQualityItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(DATA_QUALITY_COLLECTION)
    .find({ $or: [{ symbol }, { symbol: '' }, { symbol: { $exists: false } }] })
    .sort({ as_of: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    dataset: String(row.dataset || ''),
    symbol: row.symbol ? String(row.symbol) : undefined,
    as_of: String(row.as_of || ''),
    latency_sec: row.latency_sec == null ? undefined : toNumber(row.latency_sec),
    source: row.source ? String(row.source) : undefined,
    quality_flag: row.quality_flag ? String(row.quality_flag) : undefined
  })).filter((row) => row.dataset)
}

interface NorthboundFlowItem {
  trade_date: string
  net_buy: number
  sh_net_buy: number
  sz_net_buy: number
}

async function loadNorthboundFlow(limit = 30): Promise<NorthboundFlowItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(NORTHBOUND_FLOW_COLLECTION)
    .find({})
    .sort({ trade_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    trade_date: normalizeYmd(row.trade_date),
    net_buy: toNumber(row.net_buy),
    sh_net_buy: toNumber(row.sh_net_buy),
    sz_net_buy: toNumber(row.sz_net_buy)
  })).filter((row) => row.trade_date)
}

interface MarginTradingItem {
  symbol: string
  trade_date: string
  margin_balance: number
  short_balance: number
  margin_buy: number
  short_sell: number
}

async function loadMarginTrading(symbol: string, limit = 30): Promise<MarginTradingItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(MARGIN_TRADING_COLLECTION)
    .find({ symbol })
    .sort({ trade_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    trade_date: normalizeYmd(row.trade_date),
    margin_balance: toNumber(row.margin_balance),
    short_balance: toNumber(row.short_balance),
    margin_buy: toNumber(row.margin_buy),
    short_sell: toNumber(row.short_sell)
  })).filter((row) => row.trade_date)
}

interface DragonTigerItem {
  symbol: string
  trade_date: string
  reason: string
  total_amount: number
  buy_amount: number
  sell_amount: number
  net_amount: number
}

async function loadDragonTiger(symbol: string, limit = 20): Promise<DragonTigerItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(DRAGON_TIGER_COLLECTION)
    .find({ symbol })
    .sort({ trade_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    trade_date: normalizeYmd(row.trade_date),
    reason: String(row.reason || ''),
    total_amount: toNumber(row.total_amount),
    buy_amount: toNumber(row.buy_amount),
    sell_amount: toNumber(row.sell_amount),
    net_amount: toNumber(row.net_amount)
  })).filter((row) => row.trade_date)
}

interface InstitutionHoldingItem {
  symbol: string
  report_date: string
  holder_num: number
  holder_change: number
}

async function loadInstitutionHolding(symbol: string, limit = 10): Promise<InstitutionHoldingItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(INSTITUTION_HOLDING_COLLECTION)
    .find({ symbol, holder_num: { $exists: true } })
    .sort({ report_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    report_date: normalizeYmd(row.report_date),
    holder_num: toNumber(row.holder_num),
    holder_change: toNumber(row.holder_change)
  })).filter((row) => row.report_date)
}

function summarizeNewsSentiment(items: NewsSentimentItem[]) {
  if (items.length === 0) return null
  const scored = items.filter((item) => Number.isFinite(item.sentiment_score))
  if (scored.length === 0) return null
  const avgSentiment = scored.reduce((sum, item) => sum + item.sentiment_score, 0) / scored.length
  const highRelevance = scored.filter((item) => item.relevance_score >= 0.8).length
  return {
    count: scored.length,
    avg_sentiment: Number(avgSentiment.toFixed(4)),
    high_relevance_count: highRelevance
  }
}

function summarizeBenchmarks(items: IndexDailyItem[]) {
  if (items.length === 0) return [] as Array<{ index_code: string; latest_close: number; day_change: number; trend_20d: number; trade_date: string }>
  const grouped = new Map<string, IndexDailyItem[]>()
  for (const item of items) {
    const list = grouped.get(item.index_code) || []
    list.push(item)
    grouped.set(item.index_code, list)
  }

  const summary: Array<{ index_code: string; latest_close: number; day_change: number; trend_20d: number; trade_date: string }> = []
  for (const [indexCode, series] of grouped.entries()) {
    const sorted = [...series].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    const last = sorted[sorted.length - 1]
    if (!last) continue
    const base20 = sorted[Math.max(0, sorted.length - 20)]
    const trend20 = base20 && base20.close > 0
      ? ((last.close - base20.close) / base20.close) * 100
      : 0
    summary.push({
      index_code: indexCode,
      latest_close: Number(last.close.toFixed(4)),
      day_change: Number(last.pct_chg.toFixed(4)),
      trend_20d: Number(trend20.toFixed(4)),
      trade_date: last.trade_date
    })
  }
  return summary
}

function summarizeDataQuality(items: DataQualityItem[]) {
  if (items.length === 0) return null
  const bad = items.filter((item) => {
    const flag = (item.quality_flag || '').toUpperCase()
    return flag.includes('ERROR') || flag === 'EMPTY' || flag === 'PARTIAL' || flag === 'STALE'
  })
  return {
    total: items.length,
    bad_count: bad.length,
    top_issues: bad.slice(0, 5).map((item) => `${item.dataset}:${item.quality_flag || 'UNKNOWN'}`)
  }
}

// ========== Gemini 联网检索（Google Search Grounding） ==========

interface NewsItem {
  title: string
  snippet: string
  date: string
  source: string
  link: string
  score: string
}

interface ReadPageItem {
  url: string
  title: string
  content: string
}

interface SearchRoundLog {
  round: number
  query: string
  resultCount: number
}

interface GroundingSource {
  title: string
  uri: string
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim()
  if (!raw) return null

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeGroundedScore(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.50'
  const normalized = Math.min(Math.max(num, 0), 1)
  return normalized.toFixed(2)
}

async function collectGroundedNews(params: {
  stockName: string
  symbol: string
  industry: string
}): Promise<{
  summary: string
  news: NewsItem[]
  readPages: ReadPageItem[]
  searchLogs: SearchRoundLog[]
  groundingSources: GroundingSource[]
}> {
  const { stockName, symbol, industry } = params
  const aiEnabled = await isAIEnabled()
  if (!aiEnabled) {
    return {
      summary: '',
      news: [],
      readPages: [],
      searchLogs: [],
      groundingSources: []
    }
  }

  const today = normalizeYmd(new Date().toISOString())
  const queryHint = `${stockName} ${symbol} 最新消息 财报 公告 行业`

  const prompt = `请联网检索 ${stockName}（${symbol}）最近7天的关键信息，重点覆盖：公告、财报、业绩预告、行业动态、监管政策、资金动向。
行业：${industry || '未知'}。

请严格输出 JSON（不要输出任何其他文字）：
{
  "summary": "不超过120字，概括当前消息面主线",
  "items": [
    {
      "title": "新闻标题",
      "snippet": "一句话摘要",
      "date": "YYYYMMDD",
      "link": "https://...",
      "source": "媒体或机构",
      "score": 0到1之间小数
    }
  ]
}
要求：
1) items 最多20条，尽量去重。
2) date 缺失时填 ${today}。
3) score 代表与该股票分析相关性的强弱。`

  try {
    const result = await analyzeWithAI({
      systemPrompt: '你是金融研究员。你的输出必须是可解析 JSON。',
      messages: [{ role: 'user', content: prompt }]
    })

    const parsed = parseJsonObject(result.content)
    const rawItems = Array.isArray(parsed?.items)
      ? (parsed?.items as Array<Record<string, unknown>>)
      : []
    const summary = String(parsed?.summary || '').trim()

    const fallbackItems = rawItems.length > 0
      ? rawItems
      : result.sources.map((source) => ({
          title: source.title,
          snippet: '',
          date: today,
          link: source.uri,
          source: 'Google Search',
          score: 0.5
        }))

    const dedupLinks = new Set<string>()
    const news = fallbackItems
      .map((item) => {
        const title = String(item.title || '').trim()
        const snippet = String(item.snippet || '').trim()
        const date = normalizeYmd(item.date) || today
        const link = String(item.link || '').trim()
        const source = String(item.source || '').trim() || 'Google Search'
        const score = normalizeGroundedScore(item.score)

        if (!title && !link) return null
        if (link && dedupLinks.has(link)) return null
        if (link) dedupLinks.add(link)

        return {
          title: title || link,
          snippet,
          date,
          source,
          link,
          score
        }
      })
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, 20)

    const readPages = result.sources.slice(0, 20).map((item) => ({
      url: item.uri,
      title: item.title,
      content: ''
    }))

    const queryText = result.search_queries.length > 0
      ? result.search_queries.join(' | ')
      : queryHint

    const searchLogs: SearchRoundLog[] = [{
      round: 1,
      query: queryText,
      resultCount: result.sources.length
    }]

    return {
      summary,
      news,
      readPages,
      searchLogs,
      groundingSources: result.sources
    }
  } catch {
    return {
      summary: '',
      news: [],
      readPages: [],
      searchLogs: [],
      groundingSources: []
    }
  }
}

interface AIAnalysisResult {
  ai_summary: string
  ai_recommendation: string
  ai_risk_level: string
  ai_confidence: number
  ai_key_points: string[]
  ai_sources: Array<{ title: string; uri: string }>
  ai_search_queries: string[]
  predicted_kline: Array<{
    time: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

async function runAIAnalysis(
  execution: ExecutionDoc,
  klineData: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>
): Promise<AIAnalysisResult | null> {
  const aiEnabled = await isAIEnabled()
  if (!aiEnabled) return null

  const basic = execution.context.basic as { name: string; industry: string }
  const quote = execution.context.quote as { latestClose: number; prevClose: number; changePct: number; samples: number }
  const financial = execution.context.financial as { roe: number; pe: number; pb: number; revenueGrowth: number }
  const news = (execution.context.news as NewsItem[] | undefined) || []
  const groundingSources = (execution.context.news_grounding_sources as GroundingSource[] | undefined) || []
  const nextTradingDays = (execution.context.next_trading_days as string[] | undefined) || []
  const indexBenchmarks = (execution.context.index_benchmarks as IndexDailyItem[] | undefined) || []
  const fundFlow = (execution.context.fund_flow as FundFlowItem[] | undefined) || []
  const enhancedFinancial = (execution.context.financial_enhanced as FinancialEnhancedItem | null | undefined) || null
  const adjustFactors = (execution.context.adjust_factors as AdjustFactorItem[] | undefined) || []
  const corporateActions = (execution.context.corporate_actions as CorporateActionItem[] | undefined) || []
  const industryAggregation = (execution.context.industry_aggregation as IndustryAggregationItem[] | undefined) || []
  const earningsExpectation = (execution.context.earnings_expectation as EarningsExpectationItem[] | undefined) || []
  const dataQualitySummary = (execution.context.data_quality_summary as {
    total: number
    bad_count: number
    top_issues: string[]
  } | null | undefined) || null
  const newsSentimentSummary = (execution.context.news_sentiment_summary as {
    count: number
    avg_sentiment: number
    high_relevance_count: number
  } | null | undefined) || null
  const northboundFlow = (execution.context.northbound_flow as NorthboundFlowItem[] | undefined) || []
  const marginTrading = (execution.context.margin_trading as MarginTradingItem[] | undefined) || []
  const dragonTiger = (execution.context.dragon_tiger as DragonTigerItem[] | undefined) || []
  const institutionHolding = (execution.context.institution_holding as InstitutionHoldingItem[] | undefined) || []
  const dynamicTusharePlan = (execution.context.tushare_dynamic_plan as {
    selected_count: number
    total_records: number
    selected_apis: string[]
    executed: Array<{
      api_name: string
      doc_id?: number
      reason: string
      count: number
      status: 'ok' | 'error'
      message: string
    }>
  } | null | undefined) || null

  // 构建K线数据 - 全量传给AI
  const klineSummary = klineData.map((k) =>
    `${k.time}|O:${k.open}|H:${k.high}|L:${k.low}|C:${k.close}|V:${k.volume}`
  ).join('\n')

  const lastBar = klineData[klineData.length - 1]
  const lastDate = lastBar?.time || ''

  // 构建新闻 - 最多取前100条
  const topNews = news.slice(0, 100)
  const newsSummary = topNews.length > 0
    ? topNews.map((n, i) =>
      `${i + 1}. [${n.date}] [相关度:${n.score}] ${n.title}\n   ${n.snippet}`
    ).join('\n')
    : '暂无相关新闻'

  const groundingSourceText = groundingSources.length > 0
    ? groundingSources.slice(0, 30).map((item, i) => `${i + 1}. ${item.title}\n   ${item.uri}`).join('\n')
    : '暂无联网来源信息'

  const benchmarkSummary = summarizeBenchmarks(indexBenchmarks)
  const benchmarkText = benchmarkSummary.length > 0
    ? benchmarkSummary
      .map((item) => `${item.index_code}(${formatYmd(item.trade_date)}): 收盘${item.latest_close}，涨跌${item.day_change.toFixed(2)}%，20日趋势${item.trend_20d.toFixed(2)}%`)
      .join('\n')
    : '暂无基准指数数据'

  const fundFlowText = fundFlow.length > 0
    ? fundFlow.slice(0, 20).map((item, i) => {
      const details = [
        `主力净流入:${item.main_inflow}`,
        item.northbound_net == null ? '' : `北向净流入:${item.northbound_net}`,
        item.margin_balance == null ? '' : `融资余额:${item.margin_balance}`,
        item.short_balance == null ? '' : `融券余额:${item.short_balance}`
      ].filter(Boolean).join(' | ')
      return `${i + 1}. ${item.trade_date} ${details}`
    }).join('\n')
    : '暂无资金流数据'

  const enhancedFinancialText = enhancedFinancial
    ? `报告期:${enhancedFinancial.report_period || '未知'}；净利润同比:${enhancedFinancial.profit_yoy ?? 'N/A'}；毛利率:${enhancedFinancial.gross_margin ?? 'N/A'}；资产负债率:${enhancedFinancial.debt_to_asset ?? 'N/A'}；经营现金流:${enhancedFinancial.operating_cashflow ?? 'N/A'}；经营现金流/净利润:${enhancedFinancial.ocf_to_profit ?? 'N/A'}`
    : '暂无增强财务数据'

  const sentimentText = newsSentimentSummary
    ? `样本数:${newsSentimentSummary.count}；平均情绪分:${newsSentimentSummary.avg_sentiment}；高相关新闻数:${newsSentimentSummary.high_relevance_count}`
    : '暂无新闻情绪分数据'

  const adjustFactorText = adjustFactors.length > 0
    ? adjustFactors.slice(0, 20).map((item, i) => `${i + 1}. ${item.ex_dividend_date} adj:${item.adj_factor ?? 'N/A'} fore:${item.fore_adj_factor ?? 'N/A'} back:${item.back_adj_factor ?? 'N/A'}`).join('\n')
    : '暂无复权因子数据'

  const corporateActionText = corporateActions.length > 0
    ? corporateActions.slice(0, 20).map((item, i) => `${i + 1}. ${item.ex_dividend_date} [${item.action_type}] 现金分红:${item.cash_dividend_ps ?? 'N/A'} 送转:${item.bonus_share_ps ?? 'N/A'} 配股价:${item.rights_issue_price ?? 'N/A'}`).join('\n')
    : '暂无公司行为数据'

  const industryAggText = industryAggregation.length > 0
    ? industryAggregation.slice(0, 10).map((item, i) => `${i + 1}. ${item.trade_date} 行业:${item.industry_name} 主力净流入:${item.industry_main_inflow ?? 'N/A'} 情绪:${item.industry_sentiment ?? 'N/A'} 热度:${item.industry_heat ?? 'N/A'}`).join('\n')
    : '暂无行业聚合数据'

  const earningsText = earningsExpectation.length > 0
    ? earningsExpectation.slice(0, 20).map((item, i) => `${i + 1}. ${item.announce_date} [${item.source_type}] 类型:${item.forecast_type ?? 'N/A'} 净利变动:${item.profit_change_pct ?? 'N/A'} EPS:${item.eps ?? 'N/A'}`).join('\n')
    : '暂无业绩预期数据'

  const dataQualityText = dataQualitySummary
    ? `共${dataQualitySummary.total}条质量记录，异常${dataQualitySummary.bad_count}条；问题：${dataQualitySummary.top_issues.join('、') || '无'}`
    : '暂无数据质量快照'

  const dynamicTushareText = dynamicTusharePlan && dynamicTusharePlan.executed.length > 0
    ? dynamicTusharePlan.executed
      .slice(0, 20)
      .map((item, i) => `${i + 1}. ${item.api_name}${item.doc_id == null ? '' : `(doc_id:${item.doc_id})`} | ${item.status} | 条数:${item.count} | 原因:${item.reason} | 说明:${item.message}`)
      .join('\n')
    : '模型未选择额外接口或无返回'

  const tradingDayText = nextTradingDays.length > 0
    ? nextTradingDays.map((d) => formatYmd(d)).join('、')
    : '暂无交易日历数据（请按真实交易日推算）'

  const northboundText = northboundFlow.length > 0
    ? northboundFlow.slice(0, 15).map((item, i) => `${i + 1}. ${item.trade_date} 净买入:${item.net_buy}亿 沪股通:${item.sh_net_buy}亿 深股通:${item.sz_net_buy}亿`).join('\n')
    : '暂无北向资金数据'

  const marginText = marginTrading.length > 0
    ? marginTrading.slice(0, 15).map((item, i) => `${i + 1}. ${item.trade_date} 融资余额:${item.margin_balance}亿 融券余额:${item.short_balance}亿 融资买入:${item.margin_buy}亿`).join('\n')
    : '暂无融资融券数据'

  const dragonTigerText = dragonTiger.length > 0
    ? dragonTiger.slice(0, 10).map((item, i) => `${i + 1}. ${item.trade_date} [${item.reason}] 总额:${item.total_amount}万 净买:${item.net_amount}万`).join('\n')
    : '暂无龙虎榜数据'

  const institutionText = institutionHolding.length > 0
    ? institutionHolding.slice(0, 6).map((item, i) => `${i + 1}. ${item.report_date} 持仓户数:${item.holder_num} 变动:${item.holder_change}`).join('\n')
    : '暂无机构持仓数据'

  const nowBJ = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const todayStr = `${nowBJ.getUTCFullYear()}年${String(nowBJ.getUTCMonth() + 1).padStart(2, '0')}月${String(nowBJ.getUTCDate()).padStart(2, '0')}日`
  const todayYmd8 = `${nowBJ.getUTCFullYear()}${String(nowBJ.getUTCMonth() + 1).padStart(2, '0')}${String(nowBJ.getUTCDate()).padStart(2, '0')}`

  const systemPrompt = `你是一位顶级量化分析师和技术分析专家。你需要基于提供的股票数据、最新新闻资讯和联网检索来源进行深度分析，并预测未来10个交易日的K线走势。

当前日期：${todayStr}（${todayYmd8}）。所有分析和预测必须以此为基准，未来10个交易日的预测日期必须从当前日期之后开始计算。

你的分析必须严格基于数据，包括：
1. 技术面分析：K线形态、趋势、支撑位/压力位、成交量变化
2. 基本面分析：估值水平、盈利能力、行业地位
3. 消息面分析：结合最新新闻资讯和联网来源，分析利好利空因素、政策影响、行业动态
4. 资金面分析：结合资金流、新闻情绪评估短中期动量
5. 公司行为与数据可信度分析：识别复权、分红送转、异常或过期数据的影响
6. 行业与宏观共振分析：判断行业资金/情绪和宏观环境是否支撑个股走势
7. 综合研判：多空力量对比、风险评估
8. K线预测：基于当前趋势、技术形态和消息面，预测未来10个交易日的OHLCV数据

重要要求：
- 预测K线必须合理，价格变动幅度要符合该股票的历史波动率
- 新闻与联网来源中的重大利好/利空要体现在预测走势中
- 日期优先使用给定的交易日历日期，不要自行编造不存在的交易日
- 成交量预测要参考近期平均水平
- 必须严格按照指定JSON格式输出，不要输出任何其他内容`

  const userMessage = `请分析以下股票并预测未来K线：

【基本信息】
当前日期：${todayStr}（${todayYmd8}）
股票：${basic.name}（${execution.symbol}）
行业：${basic.industry}
市场：${execution.market}

【最新行情（实时）】
最新价：${quote.latestClose}
当日涨跌：${quote.changePct.toFixed(2)}%
昨收价：${quote.prevClose}

【财务指标】
ROE：${financial.roe ? financial.roe.toFixed(2) + '%' : '暂无数据'}
PE：${financial.pe ? financial.pe.toFixed(2) : '暂无数据'}
PB：${financial.pb ? financial.pb.toFixed(2) : '暂无数据'}
营收增长：${financial.revenueGrowth ? financial.revenueGrowth.toFixed(2) + '%' : '暂无数据'}

【近期K线数据（日期|开盘|最高|最低|收盘|成交量）】
${klineSummary}

【基准指数（用于相对强弱判断）】
${benchmarkText}

【资金流（近期）】
${fundFlowText}

【最新新闻资讯（共${news.length}条）】
${newsSummary}

【联网来源（用于交叉验证）】
${groundingSourceText}

【财务增强指标】
${enhancedFinancialText}

【复权因子（近期）】
${adjustFactorText}

【公司行为（分红送转配股）】
${corporateActionText}

【行业聚合（资金与情绪）】
${industryAggText}

【业绩预期/预告】
${earningsText}

【新闻情绪摘要】
${sentimentText}

【数据质量快照】
${dataQualityText}

【模型自主选择的Tushare接口结果】
${dynamicTushareText}

【北向资金（近期）】
${northboundText}

【融资融券（近期）】
${marginText}

【龙虎榜（近期）】
${dragonTigerText}

【机构持仓（股东户数）】
${institutionText}

【未来10个交易日（优先使用以下日期）】
${tradingDayText}

请严格按以下JSON格式输出（不要包含任何其他文字、不要用markdown代码块包裹）：
{
  "summary": "200字以内的综合分析摘要，必须包含对新闻面的分析",
  "recommendation": "明确的操作建议（做多/做空/观望），包含具体的入场点位、止损位、目标位",
  "risk_level": "低/中低/中/中高/高",
  "confidence": 0到100的整数,
  "key_points": ["要点1", "要点2", "要点3", "要点4", "要点5"],
  "predicted_kline": [
    {"time": "优先使用给定交易日历中的日期，格式YYYYMMDD", "open": 数字, "high": 数字, "low": 数字, "close": 数字, "volume": 数字},
    ... 共10条
  ]
}`

  try {
    const result = await analyzeWithAI({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })

    // 解析AI返回的JSON
    let parsed: Record<string, unknown>
    try {
      // 尝试直接解析
      parsed = JSON.parse(result.content.trim())
    } catch {
      // 尝试从markdown代码块中提取
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim())
      } else {
        // 尝试找到第一个 { 和最后一个 }
        const start = result.content.indexOf('{')
        const end = result.content.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(result.content.slice(start, end + 1))
        } else {
          return null
        }
      }
    }

    // 验证和提取预测K线
    const predictedKline = Array.isArray(parsed.predicted_kline)
      ? (parsed.predicted_kline as Array<Record<string, unknown>>).map((k) => ({
        time: normalizeYmd(k.time),
        open: Number(k.open ?? 0),
        high: Number(k.high ?? 0),
        low: Number(k.low ?? 0),
        close: Number(k.close ?? 0),
        volume: Number(k.volume ?? 0)
      }))
      : []

    const alignedPredictedKline = predictedKline.map((bar, idx) => ({
      ...bar,
      time: nextTradingDays[idx] || bar.time || normalizeYmd(lastDate)
    }))

    return {
      ai_summary: String(parsed.summary || ''),
      ai_recommendation: String(parsed.recommendation || ''),
      ai_risk_level: String(parsed.risk_level || '中'),
      ai_confidence: Number(parsed.confidence ?? 70),
      ai_key_points: Array.isArray(parsed.key_points)
        ? (parsed.key_points as string[]).map(String)
        : [],
      ai_sources: result.sources,
      ai_search_queries: result.search_queries,
      predicted_kline: alignedPredictedKline
    }
  } catch {
    return null
  }
}

async function buildReport(execution: ExecutionDoc) {
  const db = await getDb()
  const reports = db.collection(REPORT_COLLECTION)

  const basic = execution.context.basic as { name: string; industry: string }
  const quote = execution.context.quote as { latestClose: number; prevClose: number; changePct: number }
  const financial = execution.context.financial as { roe: number; pe: number; pb: number; revenueGrowth: number }
  const decision = execution.context.decision as { action: string; risk: string; confidence: number }
  const aiAnalysis = execution.context.ai_analysis as AIAnalysisResult | null | undefined
  const klineHistory = execution.context.kline_history as Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> | undefined
  const newsData = (execution.context.news as NewsItem[] | undefined) || []
  const readPagesReport = (execution.context.read_pages as ReadPageItem[] | undefined) || []
  const searchLogsData = (execution.context.search_logs as SearchRoundLog[] | undefined) || []
  const newsGroundingSources = (execution.context.news_grounding_sources as GroundingSource[] | undefined) || []
  const newsGroundingSummary = String(execution.context.news_grounding_summary || '')
  const dynamicTusharePlan = (execution.context.tushare_dynamic_plan as {
    selected_count: number
    total_records: number
    selected_apis: string[]
    executed: Array<{
      api_name: string
      doc_id?: number
      reason: string
      count: number
      status: 'ok' | 'error'
      message: string
    }>
  } | null | undefined) || null
  const nextTradingDays = (execution.context.next_trading_days as string[] | undefined) || []
  const indexBenchmarks = (execution.context.index_benchmarks as IndexDailyItem[] | undefined) || []
  const fundFlow = (execution.context.fund_flow as FundFlowItem[] | undefined) || []
  const enhancedFinancial = (execution.context.financial_enhanced as FinancialEnhancedItem | null | undefined) || null
  const adjustFactors = (execution.context.adjust_factors as AdjustFactorItem[] | undefined) || []
  const corporateActions = (execution.context.corporate_actions as CorporateActionItem[] | undefined) || []
  const industryAggregation = (execution.context.industry_aggregation as IndustryAggregationItem[] | undefined) || []
  const earningsExpectation = (execution.context.earnings_expectation as EarningsExpectationItem[] | undefined) || []
  const dataQualitySummary = (execution.context.data_quality_summary as {
    total: number
    bad_count: number
    top_issues: string[]
  } | null | undefined) || null
  const quantAutoFetch = (execution.context.quant_auto_fetch as {
    triggered: boolean
    reason: string
    missing: string[]
  } | null | undefined) || null
  const newsSentimentSummary = (execution.context.news_sentiment_summary as {
    count: number
    avg_sentiment: number
    high_relevance_count: number
  } | null | undefined) || null
  const northboundFlowReport = (execution.context.northbound_flow as NorthboundFlowItem[] | undefined) || []
  const marginTradingReport = (execution.context.margin_trading as MarginTradingItem[] | undefined) || []
  const dragonTigerReport = (execution.context.dragon_tiger as DragonTigerItem[] | undefined) || []
  const institutionHoldingReport = (execution.context.institution_holding as InstitutionHoldingItem[] | undefined) || []
  const benchmarkSummary = summarizeBenchmarks(indexBenchmarks)

  // 如果有AI分析结果，优先使用AI的内容
  const summary = aiAnalysis?.ai_summary
    || `${basic.name}（${execution.symbol}）当前价格 ${quote.latestClose.toFixed(2)}，当日涨跌 ${quote.changePct.toFixed(2)}%。${financial.pe ? `结合财务指标（ROE ${financial.roe.toFixed(2)}%，PE ${financial.pe.toFixed(2)}）` : ''}给出${decision.action}观点。`
  const recommendation = aiAnalysis?.ai_recommendation
    || `建议：${decision.action}。风险等级：${decision.risk}。若继续观察，请重点跟踪行业景气与成交量变化。`
  const confidenceScore = aiAnalysis?.ai_confidence ?? decision.confidence
  const riskLevel = aiAnalysis?.ai_risk_level ?? decision.risk
  const keyPoints = aiAnalysis?.ai_key_points?.length
    ? aiAnalysis.ai_key_points
    : [
      `行业：${basic.industry}`,
      `价格：${quote.latestClose.toFixed(2)}，当日涨跌 ${quote.changePct.toFixed(2)}%`,
      ...(financial.pe || financial.roe ? [`ROE：${financial.roe ? financial.roe.toFixed(2) + '%' : '暂无'}，PE：${financial.pe ? financial.pe.toFixed(2) : '暂无'}，PB：${financial.pb ? financial.pb.toFixed(2) : '暂无'}`] : [])
    ]

  const analysisId = `live_${Date.now()}_${execution.symbol}`
  const now = new Date()

  const doc = {
    analysis_id: analysisId,
    execution_id: execution._id!.toHexString(),
    user_id: execution.user_id,
    stock_symbol: execution.symbol,
    stock_name: basic.name,
    market_type: execution.market,
    summary,
    recommendation,
    confidence_score: confidenceScore,
    risk_level: riskLevel,
    key_points: keyPoints,
    predicted_kline: aiAnalysis?.predicted_kline || [],
    kline_history: klineHistory || [],
    next_trading_days: nextTradingDays,
    benchmark_summary: benchmarkSummary,
    fund_flow: fundFlow,
    financial_enhanced: enhancedFinancial,
    adjust_factors: adjustFactors,
    corporate_actions: corporateActions,
    industry_aggregation: industryAggregation,
    earnings_expectation: earningsExpectation,
    data_quality_summary: dataQualitySummary,
    quant_auto_fetch: quantAutoFetch,
    news_sentiment_summary: newsSentimentSummary,
    northbound_flow: northboundFlowReport,
    margin_trading: marginTradingReport,
    dragon_tiger: dragonTigerReport,
    institution_holding: institutionHoldingReport,
    news: newsData,
    ai_sources: aiAnalysis?.ai_sources || [],
    ai_search_queries: aiAnalysis?.ai_search_queries || [],
    news_grounding_sources: newsGroundingSources,
    news_grounding_summary: newsGroundingSummary,
    tushare_dynamic_plan: dynamicTusharePlan,
    read_pages: readPagesReport.map(p => ({ url: p.url, title: p.title })),
    search_rounds: searchLogsData.length,
    pages_read: readPagesReport.length,
    ai_powered: !!aiAnalysis,
    reports: {
      live_execution: {
        basic,
        quote,
        financial,
        decision,
        ai_analysis: aiAnalysis || null,
        next_trading_days: nextTradingDays,
        benchmark_summary: benchmarkSummary,
        fund_flow_count: fundFlow.length,
        financial_enhanced: enhancedFinancial,
        adjust_factor_count: adjustFactors.length,
        corporate_action_count: corporateActions.length,
        industry_aggregation_count: industryAggregation.length,
        earnings_expectation_count: earningsExpectation.length,
        data_quality_summary: dataQualitySummary,
        quant_auto_fetch: quantAutoFetch,
        news_sentiment_summary: newsSentimentSummary,
        northbound_flow_count: northboundFlowReport.length,
        margin_trading_count: marginTradingReport.length,
        dragon_tiger_count: dragonTigerReport.length,
        institution_holding_count: institutionHoldingReport.length,
        news_count: newsData.length,
        search_rounds: searchLogsData.length,
        ai_sources_count: aiAnalysis?.ai_sources?.length || 0,
        ai_search_query_count: aiAnalysis?.ai_search_queries?.length || 0,
        news_grounding_source_count: newsGroundingSources.length,
        news_grounding_summary: newsGroundingSummary
      }
    },
    analysts: aiAnalysis ? ['AI 深度分析引擎 (Gemini)'] : ['现场执行引擎'],
    research_depth: execution.depth,
    source: 'next-live',
    status: 'completed',
    created_at: now,
    updated_at: now,
    analysis_date: now.toISOString().slice(0, 10)
  }

  const result = await reports.insertOne(doc)
  return {
    report_id: result.insertedId.toHexString(),
    analysis_id: analysisId,
    summary,
    recommendation,
    confidence_score: confidenceScore,
    risk_level: riskLevel,
    key_points: keyPoints,
    predicted_kline: aiAnalysis?.predicted_kline || [],
    kline_history: klineHistory || [],
    next_trading_days: nextTradingDays,
    benchmark_summary: benchmarkSummary,
    fund_flow: fundFlow,
    financial_enhanced: enhancedFinancial,
    adjust_factors: adjustFactors,
    corporate_actions: corporateActions,
    industry_aggregation: industryAggregation,
    earnings_expectation: earningsExpectation,
    data_quality_summary: dataQualitySummary,
    quant_auto_fetch: quantAutoFetch,
    news_sentiment_summary: newsSentimentSummary,
    ai_sources: aiAnalysis?.ai_sources || [],
    ai_search_queries: aiAnalysis?.ai_search_queries || [],
    news_grounding_sources: newsGroundingSources,
    news_grounding_summary: newsGroundingSummary,
    tushare_dynamic_plan: dynamicTusharePlan,
    news: newsData,
    read_pages: readPagesReport.map(p => ({ url: p.url, title: p.title })),
    search_rounds: searchLogsData.length,
    pages_read: readPagesReport.length,
    ai_powered: !!aiAnalysis
  }
}

export async function markStaleExecutions(userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)
  const staleAt = new Date(Date.now() - STALE_TIMEOUT_MS)

  await executions.updateMany(
    {
      user_id: userId,
      status: 'running',
      updated_at: { $lt: staleAt }
    },
    {
      $set: {
        status: 'stopped',
        stopped_reason: '页面关闭或中断，任务已停止',
        updated_at: new Date()
      }
    }
  )
}

export async function startExecution(input: {
  userId: string
  userEmail: string
  symbol: string
  market: string
  depth: '全面'
}) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  const symbol = sanitizeSymbol(input.symbol)
  const now = new Date()
  const doc = {
    user_id: input.userId,
    user_email: input.userEmail,
    type: 'analysis' as const,
    symbol,
    market: input.market,
    depth: input.depth,
    status: 'running' as const,
    step: 0,
    total_steps: 7,
    progress: 0,
    context: {},
    created_at: now,
    updated_at: now
  }

  const result = await executions.insertOne(doc as Omit<ExecutionDoc, '_id'>)
  await createNotificationSafe({
    userId: input.userId,
    type: 'analysis',
    title: `已创建分析任务 ${symbol}`,
    content: '任务已进入页面现场执行模式。',
    link: '/executions',
    source: 'analysis'
  })
  await createOperationLogSafe({
    userId: input.userId,
    userEmail: input.userEmail,
    actionType: 'stock_analysis',
    action: `创建分析任务 ${symbol}`,
    details: {
      symbol,
      market: input.market,
      depth: input.depth
    },
    success: true
  })
  return result.insertedId.toHexString()
}

export async function createBatch(input: {
  userId: string
  title: string
  symbols: string[]
  executionIds: string[]
}) {
  const db = await getDb()
  const batches = db.collection<BatchDoc>(BATCH_COLLECTION)
  const now = new Date()
  const result = await batches.insertOne({
    user_id: input.userId,
    title: input.title,
    symbols: input.symbols,
    execution_ids: input.executionIds,
    created_at: now,
    updated_at: now
  } as Omit<BatchDoc, '_id'>)

  return result.insertedId.toHexString()
}

export async function getBatchById(batchId: string, userId: string) {
  const db = await getDb()
  const batches = db.collection<BatchDoc>(BATCH_COLLECTION)
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  const batch = await batches.findOne({
    _id: new ObjectId(batchId),
    user_id: userId
  })

  if (!batch) {
    return null
  }

  const items = await executions
    .find({
      _id: { $in: batch.execution_ids.map((id) => new ObjectId(id)) },
      user_id: userId
    })
    .toArray()

  const stats = {
    total: items.length,
    running: items.filter((item) => item.status === 'running').length,
    completed: items.filter((item) => item.status === 'completed').length,
    failed: items.filter((item) => item.status === 'failed' || item.status === 'canceled' || item.status === 'stopped').length
  }

  return {
    ...batch,
    executions: items,
    stats
  }
}

export async function getExecutionById(id: string, userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)
  const doc = await executions.findOne({
    _id: new ObjectId(id),
    user_id: userId
  })
  return doc
}

export async function listExecutions(userId: string, limit = 50) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  await markStaleExecutions(userId)

  return executions
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray()
}

function buildStatusQuery(status?: string) {
  if (!status) return {}

  if (status === 'running' || status === 'processing' || status === 'pending') {
    return { status: 'running' }
  }

  if (status === 'completed') {
    return { status: 'completed' }
  }

  if (status === 'failed') {
    return { status: { $in: ['failed', 'canceled', 'stopped'] } }
  }

  if (status === 'canceled' || status === 'stopped') {
    return { status }
  }

  return {}
}

export async function listExecutionsPaged(
  userId: string,
  options?: {
    status?: string
    limit?: number
    offset?: number
  }
) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  await markStaleExecutions(userId)

  const limit = Math.min(Math.max(options?.limit || 50, 1), 200)
  const offset = Math.max(options?.offset || 0, 0)

  const query = {
    user_id: userId,
    ...buildStatusQuery(options?.status)
  }

  const [items, total] = await Promise.all([
    executions
      .find(query as any)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    executions.countDocuments(query as any)
  ])

  return {
    items,
    total,
    limit,
    offset
  }
}

export async function cancelExecution(id: string, userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)
  const current = await executions.findOne({ _id: new ObjectId(id), user_id: userId })

  const now = new Date()
  await executions.updateOne(
    {
      _id: new ObjectId(id),
      user_id: userId
    },
    {
      $set: {
        status: 'canceled',
        updated_at: now,
        stopped_reason: '用户手动停止'
      }
    }
  )

  await createNotificationSafe({
    userId,
    type: 'system',
    title: '任务已停止',
    content: `任务 ${id} 已手动停止。`,
    link: '/executions',
    source: 'execution'
  })

  await createOperationLogSafe({
    userId,
    userEmail: current?.user_email || 'current_user',
    actionType: 'stock_analysis',
    action: `停止任务 ${current?.symbol || id}`,
    success: true
  })
}

export async function cancelAllRunningExecutions(userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  const now = new Date()
  const running = await executions
    .find({ user_id: userId, status: 'running' }, { projection: { _id: 1, symbol: 1 } })
    .toArray()

  if (running.length === 0) {
    return 0
  }

  await executions.updateMany(
    {
      user_id: userId,
      status: 'running'
    },
    {
      $set: {
        status: 'stopped',
        updated_at: now,
        stopped_reason: '页面关闭，任务自动停止'
      }
    }
  )

  await createNotificationSafe({
    userId,
    type: 'system',
    title: '页面关闭，运行中任务已停止',
    content: `共停止 ${running.length} 个任务。`,
    link: '/executions',
    source: 'execution'
  })

  return running.length
}

export async function markExecutionFailed(id: string, userId: string, reason?: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)
  const current = await executions.findOne({ _id: new ObjectId(id), user_id: userId })

  const now = new Date()
  await executions.updateOne(
    {
      _id: new ObjectId(id),
      user_id: userId
    },
    {
      $set: {
        status: 'failed',
        updated_at: now,
        stopped_reason: reason || '用户手动标记为失败'
      }
    }
  )

  await createNotificationSafe({
    userId,
    type: 'alert',
    title: '任务已标记失败',
    content: reason || `任务 ${id} 已标记为失败。`,
    link: '/executions',
    source: 'execution'
  })

  await createOperationLogSafe({
    userId,
    userEmail: current?.user_email || 'current_user',
    actionType: 'stock_analysis',
    action: `标记任务失败 ${current?.symbol || id}`,
    success: false,
    errorMessage: reason || '用户手动标记失败'
  })
}

export async function deleteExecution(id: string, userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)
  await executions.deleteOne({ _id: new ObjectId(id), user_id: userId })
}

export async function tickExecution(id: string, userId: string) {
  const db = await getDb()
  const executions = db.collection<ExecutionDoc>(EXEC_COLLECTION)

  const execution = await executions.findOne({
    _id: new ObjectId(id),
    user_id: userId
  })

  if (!execution) {
    throw new Error('任务不存在')
  }

  if (execution.status !== 'running') {
    return execution
  }

  if (Date.now() - execution.updated_at.getTime() > STALE_TIMEOUT_MS) {
    const now = new Date()
    await executions.updateOne(
      { _id: execution._id },
      {
        $set: {
          status: 'stopped',
          updated_at: now,
          stopped_reason: '页面关闭或中断，任务已停止'
        }
      }
    )
    const stopped = await executions.findOne({ _id: execution._id })
    return stopped
  }

  const context = { ...(execution.context || {}) }
  let nextStep = execution.step
  let nextStatus: ExecutionStatus = execution.status
  let resultPayload = execution.result || undefined
  let reportId = execution.report_id

  if (execution.step === 0) {
    const valid = execution.symbol.length >= 4
    if (!valid) {
      nextStatus = 'failed'
      resultPayload = { error: '股票代码格式不正确' }
      await createNotificationSafe({
        userId,
        type: 'alert',
        title: `${execution.symbol} 分析失败`,
        content: '股票代码格式不正确。',
        link: '/executions',
        source: 'analysis'
      })
    }
    nextStep += 1
  } else if (execution.step === 1) {
    const market = inferMarketFromCode(execution.symbol)
    if (market === 'A股') {
      try {
        await fetchAStockData(execution.symbol, { force: true })
      } catch {
      }
    }

    const basic = await loadStockBasic(execution.symbol)
    context.basic = basic
    nextStep += 1
  } else if (execution.step === 2) {
    const quote = await loadQuotePack(execution.symbol)
    context.quote = quote
    nextStep += 1
  } else if (execution.step === 3) {
    const financial = await loadFundamentals(execution.symbol)
    context.financial = financial
    nextStep += 1
  } else if (execution.step === 4) {
    const basic = (context.basic as { name: string; industry: string } | undefined) || {
      name: execution.symbol,
      industry: '未知行业'
    }

    const grounded = await collectGroundedNews({
      stockName: basic.name,
      symbol: execution.symbol,
      industry: basic.industry
    })

    context.news = grounded.news
    context.read_pages = grounded.readPages
    context.search_logs = grounded.searchLogs
    context.news_grounding_sources = grounded.groundingSources
    context.news_grounding_summary = grounded.summary
    nextStep += 1
  } else if (execution.step === 5) {
    const quote = context.quote as { changePct: number }
    const financial = context.financial as { roe: number; pe: number; pb: number }
    const basic = context.basic as { industry: string }
    const decision = makeDecision(quote.changePct, financial.roe, financial.pe, financial.pb)
    context.decision = decision

    const existingKline = (context.kline_history as Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> | undefined) || []
    const hasPreparedContext = existingKline.length > 0
      && Array.isArray(context.next_trading_days)
      && Array.isArray(context.index_benchmarks)
      && Array.isArray(context.fund_flow)
      && Array.isArray(context.adjust_factors)
      && Array.isArray(context.corporate_actions)
      && Array.isArray(context.industry_aggregation)
      && Array.isArray(context.earnings_expectation)
      && Array.isArray(context.northbound_flow)
      && Array.isArray(context.margin_trading)
      && Array.isArray(context.dragon_tiger)
      && Array.isArray(context.institution_holding)

    let klineData = existingKline

    if (!hasPreparedContext) {
      klineData = await loadKlineHistory(execution.symbol, 60)
      context.kline_history = klineData

      const lastKlineDate = klineData[klineData.length - 1]?.time || ''

      const quantFetchResult = await fetchAllQuantData({
        symbol: execution.symbol,
        market: execution.market,
        industry: basic.industry || ''
      }).catch(() => ({
        success: false,
        message: '增强数据拉取异常',
        results: {},
        dynamic_plan: {
          selected_count: 0,
          total_records: 0,
          selected_apis: [],
          executed: []
        }
      }))

      context.tushare_dynamic_plan = quantFetchResult.dynamic_plan

      const [
        nextTradingDays,
        indexBenchmarks,
        fundFlow,
        enhancedFinancial,
        newsSentiment,
        adjustFactors,
        corporateActions,
        industryAggregation,
        earningsExpectation,
        dataQuality,
        northboundFlowData,
        marginTradingData,
        dragonTigerData,
        institutionHoldingData
      ] = await Promise.all([
        loadNextTradingDays(lastKlineDate, execution.market, 10).catch(() => []),
        loadIndexBenchmarks(lastKlineDate, execution.market, 60).catch(() => []),
        loadFundFlow(execution.symbol, 30).catch(() => []),
        loadEnhancedFinancial(execution.symbol).catch(() => null),
        loadNewsSentiment(execution.symbol, 50).catch(() => []),
        loadAdjustFactors(execution.symbol, 30).catch(() => []),
        loadCorporateActions(execution.symbol, 30).catch(() => []),
        loadIndustryAggregation(basic.industry || '', 20).catch(() => []),
        loadEarningsExpectation(execution.symbol, 20).catch(() => []),
        loadDataQualitySnapshot(execution.symbol, 30).catch(() => []),
        loadNorthboundFlow(30).catch(() => []),
        loadMarginTrading(execution.symbol, 30).catch(() => []),
        loadDragonTiger(execution.symbol, 20).catch(() => []),
        loadInstitutionHolding(execution.symbol, 10).catch(() => [])
      ])

      context.next_trading_days = nextTradingDays
      context.index_benchmarks = indexBenchmarks
      context.fund_flow = fundFlow
      context.financial_enhanced = enhancedFinancial
      context.news_sentiment_summary = summarizeNewsSentiment(newsSentiment)
      context.adjust_factors = adjustFactors
      context.corporate_actions = corporateActions
      context.industry_aggregation = industryAggregation
      context.earnings_expectation = earningsExpectation
      context.data_quality_summary = summarizeDataQuality(dataQuality)
      context.northbound_flow = northboundFlowData
      context.margin_trading = marginTradingData
      context.dragon_tiger = dragonTigerData
      context.institution_holding = institutionHoldingData

      const missingDatasets = await detectMissingEnhancedDatasets({
        symbol: execution.symbol,
        market: execution.market,
        industry: basic.industry || '',
        lastKlineDate
      }).catch(() => [])

      const quantAutoFetch = await triggerQuantAutoFetchIfNeeded({
        symbol: execution.symbol,
        market: execution.market,
        industry: basic.industry || '',
        missingDatasets,
        userId
      }).catch(() => ({
        triggered: false,
        reason: 'error',
        missing: missingDatasets
      }))

      context.quant_auto_fetch = quantAutoFetch
    }

    await executions.updateOne(
      { _id: execution._id },
      {
        $set: {
          context,
          updated_at: new Date()
        }
      }
    )

    const aiResult = await runAIAnalysis(
      { ...execution, context } as ExecutionDoc,
      klineData
    )

    if (aiResult) {
      context.ai_analysis = aiResult
    } else {
      context.ai_analysis = null
    }

    nextStep += 1
  } else if (execution.step === 6) {
    const report = await buildReport({
      ...execution,
      step: nextStep,
      context
    })

    reportId = report.report_id
    resultPayload = report
    nextStatus = 'completed'
    nextStep += 1

    await createNotificationSafe({
      userId,
      type: 'analysis',
      title: `${execution.symbol} 分析完成`,
      content: report.ai_powered ? 'AI深度分析报告已生成，含K线预测。' : '报告已生成，可直接打开查看。',
      link: `/reports/${report.report_id}`,
      source: 'analysis'
    })

    await createOperationLogSafe({
      userId,
      userEmail: execution.user_email,
      actionType: 'report_generation',
      action: `${execution.symbol} 分析完成并生成报告`,
      success: true,
      details: {
        report_id: report.report_id,
        analysis_id: report.analysis_id,
        ai_powered: report.ai_powered
      }
    })
  }

  const progress = Math.min(100, Math.round((nextStep / execution.total_steps) * 100))

  await executions.updateOne(
    { _id: execution._id },
    {
      $set: {
        step: nextStep,
        status: nextStatus,
        progress,
        context,
        result: resultPayload,
        report_id: reportId,
        updated_at: new Date()
      }
    }
  )

  return executions.findOne({ _id: execution._id })
}
