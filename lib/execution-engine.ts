import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { fetchAllQuantData } from '@/lib/fetch-quant-data'
import { inferMarketFromCode } from '@/lib/market'
import { createOperationLog } from '@/lib/operation-logs'
import { analyzeWithAI, isAIEnabled } from '@/lib/ai-client'

const EXEC_COLLECTION = 'web_executions'
const REPORT_COLLECTION = 'analysis_reports'
const BATCH_COLLECTION = 'web_batches'
const CALENDAR_COLLECTION = 'trading_calendar'
const INDEX_COLLECTION = 'index_daily'
const FUND_FLOW_COLLECTION = 'stock_fund_flow'
const EVENT_COLLECTION = 'stock_events'
const FINANCIAL_ENHANCED_COLLECTION = 'financial_enhanced'
const NEWS_SENTIMENT_COLLECTION = 'news_sentiment'
const ADJUST_FACTOR_COLLECTION = 'stock_adjust_factors'
const CORPORATE_ACTION_COLLECTION = 'stock_corporate_actions'
const INDUSTRY_AGG_COLLECTION = 'industry_aggregation'
const EARNINGS_EXPECT_COLLECTION = 'earnings_expectation'
const MACRO_CALENDAR_COLLECTION = 'macro_calendar'
const DATA_QUALITY_COLLECTION = 'data_quality'
const INTRADAY_COLLECTION = 'stock_intraday'
const QUANT_AUTO_FETCH_LOG_COLLECTION = 'quant_auto_fetch_logs'
const NORTHBOUND_FLOW_COLLECTION = 'northbound_flow'
const MARGIN_TRADING_COLLECTION = 'margin_trading'
const DRAGON_TIGER_COLLECTION = 'dragon_tiger'
const INSTITUTION_HOLDING_COLLECTION = 'institution_holding'

const STALE_TIMEOUT_MS = 150 * 1000

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'canceled' | 'stopped'

export interface ExecutionLog {
  at: Date
  text: string
}

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
  logs: ExecutionLog[]
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

function appendLog(execution: ExecutionDoc, text: string): ExecutionLog[] {
  return [...(execution.logs || []), { at: new Date(), text }]
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
  const db = await getDb()
  const rows = await db
    .collection('stock_quotes')
    .find({ symbol, data_source: 'eastmoney_kline' })
    .sort({ trade_date: -1 })
    .limit(30)
    .toArray()

  if (rows.length > 0) {
    const latestClose = Number(rows[0].close ?? 0)
    const prevClose = Number(rows[rows.length - 1].close ?? latestClose)
    const changePct = prevClose > 0 ? ((latestClose - prevClose) / prevClose) * 100 : 0

    return {
      latestClose,
      prevClose,
      changePct,
      samples: rows.length
    }
  }

  return {
    latestClose: 0,
    prevClose: 0,
    changePct: 0,
    samples: 0
  }
}

async function loadFundamentals(symbol: string) {
  const db = await getDb()

  const doc = await db.collection('financial_data').findOne(
    { symbol },
    { sort: { report_date: -1, updated_at: -1 } }
  )

  if (doc) {
    return {
      roe: Number(doc.roe ?? 0),
      pe: Number(doc.pe ?? 0),
      pb: Number(doc.pb ?? 0),
      revenueGrowth: Number(doc.revenue_yoy ?? 0)
    }
  }

  // financial_data 没有时从 stock_basic_info 读取（东方财富实时行情写入的 PE/PB）
  const basicDoc = await db.collection('stock_basic_info').findOne({ symbol })
  if (basicDoc && (basicDoc.pe || basicDoc.pb)) {
    return {
      roe: Number(basicDoc.roe ?? 0),
      pe: Number(basicDoc.pe ?? 0),
      pb: Number(basicDoc.pb ?? 0),
      revenueGrowth: Number(basicDoc.revenue_yoy ?? 0)
    }
  }

  return { roe: 0, pe: 0, pb: 0, revenueGrowth: 0 }
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
    .find({ symbol, data_source: 'eastmoney_kline' })
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

interface StockEventItem {
  symbol: string
  event_type: string
  event_date: string
  title: string
  impact: string
  url?: string
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

interface MacroCalendarItem {
  date: string
  indicator: string
  value?: number
  previous?: number
}

interface DataQualityItem {
  dataset: string
  symbol?: string
  as_of: string
  latency_sec?: number
  source?: string
  quality_flag?: string
}

interface IntradayItem {
  symbol: string
  datetime: string
  period: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  amount?: number
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
  if (market.includes('A')) {
    return ['SSE', 'SZSE', 'CN', 'A股']
  }
  if (market.includes('港')) {
    return ['HKEX', 'HK', '港股']
  }
  if (market.includes('美')) {
    return ['NASDAQ', 'NYSE', 'US', '美股']
  }
  return [market]
}

function getIndexCandidatesByMarket(market: string): string[] {
  if (market.includes('A')) {
    return ['000300', '000001', '399001', '399006']
  }
  if (market.includes('港')) {
    return ['HSI', 'HSCEI']
  }
  if (market.includes('美')) {
    return ['SPX', 'NDX', 'DJI']
  }
  return ['000300']
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
    eventCount,
    financialCount,
    sentimentCount,
    adjustFactorCount,
    corporateActionCount,
    industryAggCount,
    earningsCount,
    macroCount,
    intradayCount
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
    db.collection(EVENT_COLLECTION).countDocuments({
      symbol,
      event_date: { $gte: ymdDaysAgo(180) }
    }, { limit: 20 }),
    db.collection(FINANCIAL_ENHANCED_COLLECTION).countDocuments({ symbol }, { limit: 1 }),
    db.collection(NEWS_SENTIMENT_COLLECTION).countDocuments({ symbol }, { limit: 20 }),
    db.collection(ADJUST_FACTOR_COLLECTION).countDocuments({ symbol }, { limit: 10 }),
    db.collection(CORPORATE_ACTION_COLLECTION).countDocuments({ symbol }, { limit: 10 }),
    industry
      ? db.collection(INDUSTRY_AGG_COLLECTION).countDocuments({ industry_name: industry }, { limit: 10 })
      : Promise.resolve(0),
    db.collection(EARNINGS_EXPECT_COLLECTION).countDocuments({ symbol }, { limit: 10 }),
    db.collection(MACRO_CALENDAR_COLLECTION).countDocuments({}, { limit: 5 }),
    db.collection(INTRADAY_COLLECTION).countDocuments({ symbol, period: '1' }, { limit: 60 })
  ])

  if (tradingDaysCount < 10) missing.push('trading_calendar')
  if (indexCount < 20) missing.push('index_daily')
  if (fundFlowCount < 8) missing.push('stock_fund_flow')
  if (eventCount < 3) missing.push('stock_events')
  if (financialCount < 1) missing.push('financial_enhanced')
  if (sentimentCount < 5) missing.push('news_sentiment')
  if (adjustFactorCount < 3) missing.push('stock_adjust_factors')
  if (corporateActionCount < 2) missing.push('stock_corporate_actions')
  if (industry && industryAggCount < 1) missing.push('industry_aggregation')
  if (earningsCount < 1) missing.push('earnings_expectation')
  if (macroCount < 1) missing.push('macro_calendar')
  if (intradayCount < 20) missing.push('stock_intraday')

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
  const db = await getDb()
  const startDate = normalizeYmd(lastDate)
  const formattedStart = formatYmd(startDate)
  const rows = await db
    .collection(INDEX_COLLECTION)
    .find({
      index_code: { $in: getIndexCandidatesByMarket(market) },
      ...(startDate
        ? {
            $or: [
              { trade_date: { $lte: startDate } },
              { trade_date: { $lte: formattedStart } }
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

async function loadStockEvents(symbol: string, limit = 50): Promise<StockEventItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(EVENT_COLLECTION)
    .find({ symbol })
    .sort({ event_date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    event_type: String(row.event_type || 'announcement'),
    event_date: normalizeYmd(row.event_date),
    title: String(row.title || ''),
    impact: String(row.impact || 'unknown'),
    url: row.url ? String(row.url) : undefined
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

async function loadMacroCalendar(limit = 40): Promise<MacroCalendarItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(MACRO_CALENDAR_COLLECTION)
    .find({})
    .sort({ date: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    date: String(row.date || ''),
    indicator: String(row.indicator || ''),
    value: row.value == null ? undefined : toNumber(row.value),
    previous: row.previous == null ? undefined : toNumber(row.previous)
  })).filter((row) => row.indicator)
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

async function loadIntraday(symbol: string, period = '1', limit = 180): Promise<IntradayItem[]> {
  const db = await getDb()
  const rows = await db
    .collection(INTRADAY_COLLECTION)
    .find({ symbol, period })
    .sort({ datetime: -1, updated_at: -1, created_at: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => ({
    symbol,
    datetime: String(row.datetime || ''),
    period,
    open: row.open == null ? undefined : toNumber(row.open),
    high: row.high == null ? undefined : toNumber(row.high),
    low: row.low == null ? undefined : toNumber(row.low),
    close: row.close == null ? undefined : toNumber(row.close),
    volume: row.volume == null ? undefined : toNumber(row.volume),
    amount: row.amount == null ? undefined : toNumber(row.amount)
  })).filter((row) => row.datetime)
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
    .find({ symbol })
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
  if (items.length === 0) return [] as Array<{ index_code: string; latest_close: number; day_change: number; trend_20d: number }>
  const grouped = new Map<string, IndexDailyItem[]>()
  for (const item of items) {
    const list = grouped.get(item.index_code) || []
    list.push(item)
    grouped.set(item.index_code, list)
  }

  const summary: Array<{ index_code: string; latest_close: number; day_change: number; trend_20d: number }> = []
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
      trend_20d: Number(trend20.toFixed(4))
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

// ========== Metaso 联网搜索 + 网页阅读 ==========

interface MetasoWebpage {
  title: string
  link: string
  score: string
  snippet: string
  position: number
  date?: string
  authors?: string[]
}

interface MetasoSearchResult {
  webpages: MetasoWebpage[]
  total: number
}

async function metasoSearch(query: string): Promise<MetasoSearchResult> {
  const apiKey = process.env.METASO_API_KEY
  if (!apiKey) return { webpages: [], total: 0 }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch('https://metaso.cn/api/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        scope: 'webpage',
        includeSummary: false,
        size: 100,
        includeRawContent: false,
        conciseSnippet: true
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) return { webpages: [], total: 0 }

    const data = await response.json()
    const webpages = (data.webpages || []).map((w: MetasoWebpage) => ({
      title: w.title || '',
      link: w.link || '',
      score: w.score || '',
      snippet: w.snippet || '',
      position: w.position || 0,
      date: w.date || '',
      authors: w.authors || []
    }))

    return { webpages, total: data.total || 0 }
  } catch {
    clearTimeout(timeoutId)
    return { webpages: [], total: 0 }
  }
}

async function metasoReadPage(url: string): Promise<string> {
  const apiKey = process.env.METASO_API_KEY
  if (!apiKey) return ''

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch('https://metaso.cn/api/v1/reader', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/plain',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) return ''

    return await response.text()
  } catch {
    clearTimeout(timeoutId)
    return ''
  }
}

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

interface PendingReadItem {
  url: string
  reason: string
}

interface SearchState {
  phase: 'search' | 'decide' | 'read' | 'done'
  searchRound: number
  totalReads: number
  news: NewsItem[]
  readPages: ReadPageItem[]
  searchLogs: SearchRoundLog[]
  seenLinks: string[]
  readUrls: string[]
  pendingReads: PendingReadItem[]
  nextQuery: string
}

function initSearchState(): SearchState {
  return {
    phase: 'search',
    searchRound: 0,
    totalReads: 0,
    news: [],
    readPages: [],
    searchLogs: [],
    seenLinks: [],
    readUrls: [],
    pendingReads: [],
    nextQuery: ''
  }
}

async function executeOneSearchRound(
  state: SearchState,
  stockName: string,
  symbol: string,
  industry: string
): Promise<{ state: SearchState; log: string; done: boolean }> {
  const aiEnabled = await isAIEnabled()
  const seenLinks = new Set(state.seenLinks)

  if (state.searchRound >= 10) {
    state.phase = 'decide'
    return { state, log: '搜索已达 10 轮上限，进入阅读决策阶段', done: false }
  }

  const query = state.searchRound === 0
    ? `${stockName} ${symbol} 最新消息 股票`
    : (state.nextQuery || `${stockName} ${symbol} ${industry} 最新动态 行业影响 财报`)

  const result = await metasoSearch(query)
  let newCount = 0

  for (const w of result.webpages) {
    if (!seenLinks.has(w.link)) {
      seenLinks.add(w.link)
      state.news.push({
        title: w.title,
        snippet: w.snippet,
        date: w.date || '',
        source: w.link,
        link: w.link,
        score: w.score
      })
      newCount++
    }
  }

  state.seenLinks = Array.from(seenLinks)
  state.searchRound += 1
  state.searchLogs.push({ round: state.searchRound, query, resultCount: result.webpages.length })
  state.phase = 'decide'

  if (!aiEnabled) {
    state.phase = 'done'
    return { state, log: `第 ${state.searchRound} 轮搜索获取 ${result.webpages.length} 条结果（AI 未启用，跳过后续决策）`, done: true }
  }

  return { state, log: `搜索第 ${state.searchRound} 轮：${query}，获取 ${result.webpages.length} 条结果，新增 ${newCount} 条`, done: false }
}

async function executeDecideRound(
  state: SearchState,
  stockName: string,
  symbol: string,
  industry: string
): Promise<{ state: SearchState; log: string; done: boolean }> {
  const readUrls = new Set(state.readUrls)
  const remainingSlots = Math.max(0, 10 - state.totalReads)

  if (state.news.length === 0) {
    if (state.searchRound >= 10) {
      state.phase = 'done'
      return { state, log: '无可用新闻且搜索已达上限，结束联网阶段', done: true }
    }
    state.phase = 'search'
    state.nextQuery = `${stockName} ${symbol} 最新消息 股票`
    return { state, log: '暂无可用新闻，继续下一轮搜索', done: false }
  }

  const newsList = state.news.map((n, i) =>
    `${i + 1}. [${n.date}] [相关度:${n.score}] ${n.title}\n   链接: ${n.link}\n   摘要: ${n.snippet}`
  ).join('\n')

  const readSummary = state.readPages.length > 0
    ? '\n\n已深度阅读网页：\n' + state.readPages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`).join('\n')
    : ''

  const decidePrompt = `你是一位股票研究员，正在研究 ${stockName}（${symbol}，${industry}行业）。

以下是目前收集到的新闻（共 ${state.news.length} 条）：
${newsList}
${readSummary}

当前还可阅读网页数量上限：${remainingSlots}（总上限10）。

请你一次性判断：
1) 本轮建议深入阅读哪些网页（可返回多个URL，按优先级排序）
2) 当前信息是否已经足够用于后续分析
3) 如果信息不够，下一轮应该搜索什么关键词

请严格按以下JSON格式回复（不要包含其他文字）：
{"read_urls": ["url1", "url2"], "read_reasons": ["原因1", "原因2"], "enough": true或false, "next_query": "如果不够，填写下一轮搜索关键词"}`

  try {
    const decision = await analyzeWithAI({
      systemPrompt: '你是一位专业的股票研究助手。只输出JSON，不要输出其他内容。',
      messages: [{ role: 'user', content: decidePrompt }],
      depth: 'deep'
    })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(decision.content.trim())
    } catch {
      const start = decision.content.indexOf('{')
      const end = decision.content.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(decision.content.slice(start, end + 1))
      } else {
        if (state.searchRound >= 10) {
          state.phase = 'done'
          return { state, log: 'AI 决策解析失败且搜索达上限，结束联网阶段', done: true }
        }
        state.phase = 'search'
        state.nextQuery = `${stockName} ${symbol} 最新动态 股票`
        return { state, log: 'AI 决策解析失败，继续下一轮搜索', done: false }
      }
    }

    const enough = parsed.enough === true
    const nextQueryRaw = typeof parsed.next_query === 'string' ? parsed.next_query.trim() : ''
    const nextQuery = nextQueryRaw || `${stockName} ${symbol} 最新动态 行业 财报`

    const rawUrls = Array.isArray(parsed.read_urls)
      ? parsed.read_urls.map(u => String(u || '').trim()).filter(Boolean)
      : []
    const rawReasons = Array.isArray(parsed.read_reasons)
      ? parsed.read_reasons.map(r => String(r || '').trim())
      : []

    const dedup = new Set<string>()
    const candidates: PendingReadItem[] = []
    for (let i = 0; i < rawUrls.length; i++) {
      const url = rawUrls[i]
      if (!url || dedup.has(url) || readUrls.has(url)) continue
      const existsInNews = state.news.some(n => n.link === url)
      if (!existsInNews) continue
      dedup.add(url)
      candidates.push({
        url,
        reason: rawReasons[i] || 'AI 认为该网页需要优先阅读'
      })
    }

    const selected = candidates.slice(0, remainingSlots)
    state.pendingReads = selected
    state.nextQuery = nextQuery

    if (selected.length > 0) {
      state.phase = 'read'
      return { state, log: `阅读决策完成：本轮选出 ${selected.length} 个网页待阅读` + (enough ? '（信息已较充分）' : '（信息仍需补充）'), done: false }
    }

    if (enough) {
      state.phase = 'done'
      return { state, log: `AI 判断信息已充分，无需新增网页阅读，共阅读 ${state.readPages.length} 个网页`, done: true }
    }

    if (state.searchRound >= 10) {
      state.phase = 'done'
      return { state, log: `AI 判断信息仍不足，但搜索已达 10 轮上限，结束联网阶段`, done: true }
    }

    state.phase = 'search'
    return { state, log: `AI 判断信息仍不足且本轮无新增网页阅读，继续搜索：${state.nextQuery}`, done: false }
  } catch {
    if (state.searchRound >= 10) {
      state.phase = 'done'
      return { state, log: 'AI 决策失败且搜索达上限，结束联网阶段', done: true }
    }
    state.phase = 'search'
    state.nextQuery = state.nextQuery || `${stockName} ${symbol} 最新动态 股票`
    return { state, log: 'AI 决策失败，继续下一轮搜索', done: false }
  }
}

async function executeContinueReadDecision(
  state: SearchState,
  stockName: string,
  symbol: string,
  industry: string
): Promise<{ state: SearchState; log: string; done: boolean }> {
  const remainingList = state.pendingReads.map((item, i) =>
    `${i + 1}. ${item.url}\n   原因: ${item.reason}`
  ).join('\n') || '无'

  const readSummary = state.readPages.length > 0
    ? state.readPages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`).join('\n')
    : '无'

  const prompt = `你是一位股票研究员，正在研究 ${stockName}（${symbol}，${industry}行业）。

已阅读网页（共 ${state.readPages.length} 个）：
${readSummary}

当前待阅读网页（共 ${state.pendingReads.length} 个）：
${remainingList}

请你判断三件事：
1) 是否继续阅读剩余网页（continue_reading）
2) 当前信息是否已经足够（enough）
3) 如果信息不够，下一轮搜索关键词是什么（next_query）

请严格按以下JSON格式回复（不要包含其他文字）：
{"continue_reading": true或false, "enough": true或false, "next_query": "如果不够，填写下一轮搜索关键词"}`

  try {
    const decision = await analyzeWithAI({
      systemPrompt: '你是一位专业的股票研究助手。只输出JSON，不要输出其他内容。',
      messages: [{ role: 'user', content: prompt }],
      depth: 'deep'
    })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(decision.content.trim())
    } catch {
      const start = decision.content.indexOf('{')
      const end = decision.content.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(decision.content.slice(start, end + 1))
      } else {
        parsed = {}
      }
    }

    const continueReading = parsed.continue_reading === true
    const enough = parsed.enough === true
    const nextQueryRaw = typeof parsed.next_query === 'string' ? parsed.next_query.trim() : ''
    state.nextQuery = nextQueryRaw || state.nextQuery || `${stockName} ${symbol} 最新动态 行业 财报`

    if (continueReading && state.pendingReads.length > 0 && state.totalReads < 10) {
      state.phase = 'read'
      return { state, log: `阅读后复核：继续阅读剩余网页（剩余 ${state.pendingReads.length} 个）`, done: false }
    }

    state.pendingReads = []

    if (enough) {
      state.phase = 'done'
      return { state, log: `阅读后复核：信息已充分，结束联网阶段（共阅读 ${state.readPages.length} 个网页）`, done: true }
    }

    if (state.searchRound >= 10) {
      state.phase = 'done'
      return { state, log: '阅读后复核：信息仍不足，但搜索已达 10 轮上限，结束联网阶段', done: true }
    }

    state.phase = 'search'
    return { state, log: `阅读后复核：停止继续阅读，转入下一轮搜索（关键词：${state.nextQuery}）`, done: false }
  } catch {
    if (state.pendingReads.length > 0 && state.totalReads < 10) {
      state.phase = 'read'
      return { state, log: '阅读后复核失败，默认继续阅读剩余网页', done: false }
    }
    if (state.searchRound >= 10) {
      state.phase = 'done'
      return { state, log: '阅读后复核失败且搜索达上限，结束联网阶段', done: true }
    }
    state.phase = 'search'
    state.nextQuery = state.nextQuery || `${stockName} ${symbol} 最新动态 股票`
    return { state, log: '阅读后复核失败，继续下一轮搜索', done: false }
  }
}

async function executeOneReadRound(
  state: SearchState,
  stockName: string,
  symbol: string,
  industry: string
): Promise<{ state: SearchState; log: string; done: boolean }> {
  const readUrls = new Set(state.readUrls)

  if (state.totalReads >= 10) {
    state.phase = 'done'
    return { state, log: `网页深度阅读已达 10 次上限，共阅读 ${state.readPages.length} 个网页`, done: true }
  }

  if (state.pendingReads.length === 0) {
    state.phase = 'decide'
    return { state, log: '当前没有待阅读网页，返回阅读决策阶段', done: false }
  }

  const current = state.pendingReads.shift() as PendingReadItem
  const targetUrl = current.url
  const reason = current.reason

  if (readUrls.has(targetUrl)) {
    const next = await executeContinueReadDecision(state, stockName, symbol, industry)
    return { state: next.state, log: `网页已阅读过，跳过：${targetUrl}；${next.log}`, done: next.done }
  }

  readUrls.add(targetUrl)
  state.readUrls = Array.from(readUrls)

  const pageContent = await metasoReadPage(targetUrl)
  if (pageContent) {
    const matchingNews = state.news.find(n => n.link === targetUrl)
    state.totalReads += 1
    state.readPages.push({
      url: targetUrl,
      title: matchingNews?.title || targetUrl,
      content: pageContent
    })
    const next = await executeContinueReadDecision(state, stockName, symbol, industry)
    return {
      state: next.state,
      log: `深度阅读第 ${state.totalReads} 个网页：${reason}（${pageContent.length} 字符）；${next.log}`,
      done: next.done
    }
  }

  const next = await executeContinueReadDecision(state, stockName, symbol, industry)
  return { state: next.state, log: `网页读取失败：${targetUrl}；${next.log}`, done: next.done }
}

interface AIAnalysisResult {
  ai_summary: string
  ai_recommendation: string
  ai_risk_level: string
  ai_confidence: number
  ai_key_points: string[]
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
  const quote = execution.context.quote as { latestClose: number; changePct: number; samples: number }
  const financial = execution.context.financial as { roe: number; pe: number; pb: number; revenueGrowth: number }
  const news = (execution.context.news as NewsItem[] | undefined) || []
  const readPagesData = (execution.context.read_pages as ReadPageItem[] | undefined) || []
  const nextTradingDays = (execution.context.next_trading_days as string[] | undefined) || []
  const indexBenchmarks = (execution.context.index_benchmarks as IndexDailyItem[] | undefined) || []
  const fundFlow = (execution.context.fund_flow as FundFlowItem[] | undefined) || []
  const stockEvents = (execution.context.stock_events as StockEventItem[] | undefined) || []
  const enhancedFinancial = (execution.context.financial_enhanced as FinancialEnhancedItem | null | undefined) || null
  const adjustFactors = (execution.context.adjust_factors as AdjustFactorItem[] | undefined) || []
  const corporateActions = (execution.context.corporate_actions as CorporateActionItem[] | undefined) || []
  const industryAggregation = (execution.context.industry_aggregation as IndustryAggregationItem[] | undefined) || []
  const earningsExpectation = (execution.context.earnings_expectation as EarningsExpectationItem[] | undefined) || []
  const macroCalendar = (execution.context.macro_calendar as MacroCalendarItem[] | undefined) || []
  const intradayData = (execution.context.intraday_data as IntradayItem[] | undefined) || []
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

  // 构建深度阅读的网页内容 - 每篇最多10000字符，避免prompt超出上下文窗口
  const MAX_PAGE_CHARS = 10000
  const readPagesSummary = readPagesData.length > 0
    ? readPagesData.map((p, i) => {
        const truncated = p.content.length > MAX_PAGE_CHARS
          ? p.content.slice(0, MAX_PAGE_CHARS) + '\n...(内容已截断)'
          : p.content
        return `===== 深度阅读 ${i + 1}: ${p.title} =====\n来源: ${p.url}\n${truncated}`
      }).join('\n\n')
    : ''

  const benchmarkSummary = summarizeBenchmarks(indexBenchmarks)
  const benchmarkText = benchmarkSummary.length > 0
    ? benchmarkSummary
      .map((item) => `${item.index_code}: 最新${item.latest_close}，当日${item.day_change.toFixed(2)}%，20日${item.trend_20d.toFixed(2)}%`)
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

  const stockEventText = stockEvents.length > 0
    ? stockEvents.slice(0, 30).map((item, i) => `${i + 1}. [${item.event_date}] [${item.event_type}] [影响:${item.impact}] ${item.title}`).join('\n')
    : '暂无公告事件数据'

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

  const macroText = macroCalendar.length > 0
    ? macroCalendar.slice(0, 20).map((item, i) => `${i + 1}. ${item.date} ${item.indicator}: 当前${item.value ?? 'N/A'} 前值${item.previous ?? 'N/A'}`).join('\n')
    : '暂无宏观日历数据'

  const dataQualityText = dataQualitySummary
    ? `共${dataQualitySummary.total}条质量记录，异常${dataQualitySummary.bad_count}条；问题：${dataQualitySummary.top_issues.join('、') || '无'}`
    : '暂无数据质量快照'

  const intradayText = intradayData.length > 0
    ? intradayData.slice(0, 60).reverse().map((item, i) => `${i + 1}. ${item.datetime} O:${item.open ?? 'N/A'} H:${item.high ?? 'N/A'} L:${item.low ?? 'N/A'} C:${item.close ?? 'N/A'} V:${item.volume ?? 'N/A'}`).join('\n')
    : '暂无分时盘口数据'

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

  const systemPrompt = `你是一位顶级量化分析师和技术分析专家。你需要基于提供的股票数据、最新新闻资讯和深度阅读的网页内容进行深度分析，并预测未来10个交易日的K线走势。

你的分析必须严格基于数据，包括：
1. 技术面分析：K线形态、趋势、支撑位/压力位、成交量变化
2. 基本面分析：估值水平、盈利能力、行业地位
3. 消息面分析：结合最新新闻资讯和深度阅读的网页内容，分析利好利空因素、政策影响、行业动态
4. 资金面与事件面分析：结合资金流、公告事件、新闻情绪评估短中期动量
5. 公司行为与数据可信度分析：识别复权、分红送转、异常或过期数据的影响
6. 行业与宏观共振分析：判断行业资金/情绪和宏观环境是否支撑个股走势
7. 综合研判：多空力量对比、风险评估
8. K线预测：基于当前趋势、技术形态和消息面，预测未来10个交易日的OHLCV数据

重要要求：
- 预测K线必须合理，价格变动幅度要符合该股票的历史波动率
- 新闻和深度阅读内容中的重大利好/利空要体现在预测走势中
- 日期优先使用给定的交易日历日期，不要自行编造不存在的交易日
- 成交量预测要参考近期平均水平
- 必须严格按照指定JSON格式输出，不要输出任何其他内容`

  const userMessage = `请分析以下股票并预测未来K线：

【基本信息】
股票：${basic.name}（${execution.symbol}）
行业：${basic.industry}
市场：${execution.market}

【最新行情】
最新价：${quote.latestClose}
阶段涨跌：${quote.changePct.toFixed(2)}%

【财务指标】
ROE：${financial.roe.toFixed(2)}%
PE：${financial.pe.toFixed(2)}
PB：${financial.pb.toFixed(2)}
营收增长：${financial.revenueGrowth.toFixed(2)}%

【近期K线数据（日期|开盘|最高|最低|收盘|成交量）】
${klineSummary}

【基准指数（用于相对强弱判断）】
${benchmarkText}

【资金流（近期）】
${fundFlowText}

【最新新闻资讯（共${news.length}条）】
${newsSummary}
${readPagesSummary ? `\n【深度阅读的网页内容（共${readPagesData.length}篇）】\n${readPagesSummary}` : ''}

【公告与事件（近期）】
${stockEventText}

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

【宏观日历】
${macroText}

【分时盘口（最近）】
${intradayText}

【新闻情绪摘要】
${sentimentText}

【数据质量快照】
${dataQualityText}

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
      messages: [{ role: 'user', content: userMessage }],
      depth: 'deep'
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
  const quote = execution.context.quote as { latestClose: number; changePct: number }
  const financial = execution.context.financial as { roe: number; pe: number; pb: number; revenueGrowth: number }
  const decision = execution.context.decision as { action: string; risk: string; confidence: number }
  const aiAnalysis = execution.context.ai_analysis as AIAnalysisResult | null | undefined
  const klineHistory = execution.context.kline_history as Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> | undefined
  const newsData = (execution.context.news as NewsItem[] | undefined) || []
  const readPagesReport = (execution.context.read_pages as ReadPageItem[] | undefined) || []
  const searchLogsData = (execution.context.search_logs as SearchRoundLog[] | undefined) || []
  const nextTradingDays = (execution.context.next_trading_days as string[] | undefined) || []
  const indexBenchmarks = (execution.context.index_benchmarks as IndexDailyItem[] | undefined) || []
  const fundFlow = (execution.context.fund_flow as FundFlowItem[] | undefined) || []
  const stockEvents = (execution.context.stock_events as StockEventItem[] | undefined) || []
  const enhancedFinancial = (execution.context.financial_enhanced as FinancialEnhancedItem | null | undefined) || null
  const adjustFactors = (execution.context.adjust_factors as AdjustFactorItem[] | undefined) || []
  const corporateActions = (execution.context.corporate_actions as CorporateActionItem[] | undefined) || []
  const industryAggregation = (execution.context.industry_aggregation as IndustryAggregationItem[] | undefined) || []
  const earningsExpectation = (execution.context.earnings_expectation as EarningsExpectationItem[] | undefined) || []
  const macroCalendar = (execution.context.macro_calendar as MacroCalendarItem[] | undefined) || []
  const intradayData = (execution.context.intraday_data as IntradayItem[] | undefined) || []
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
    || `${basic.name}（${execution.symbol}）当前价格 ${quote.latestClose.toFixed(2)}，阶段涨跌 ${quote.changePct.toFixed(2)}%。结合财务指标（ROE ${financial.roe.toFixed(2)}%，PE ${financial.pe.toFixed(2)}）给出${decision.action}观点。`
  const recommendation = aiAnalysis?.ai_recommendation
    || `建议：${decision.action}。风险等级：${decision.risk}。若继续观察，请重点跟踪行业景气与成交量变化。`
  const confidenceScore = aiAnalysis?.ai_confidence ?? decision.confidence
  const riskLevel = aiAnalysis?.ai_risk_level ?? decision.risk
  const keyPoints = aiAnalysis?.ai_key_points?.length
    ? aiAnalysis.ai_key_points
    : [
        `行业：${basic.industry}`,
        `价格：${quote.latestClose.toFixed(2)}，阶段变化 ${quote.changePct.toFixed(2)}%`,
        `ROE：${financial.roe.toFixed(2)}%，PE：${financial.pe.toFixed(2)}，PB：${financial.pb.toFixed(2)}`
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
    stock_events: stockEvents,
    financial_enhanced: enhancedFinancial,
    adjust_factors: adjustFactors,
    corporate_actions: corporateActions,
    industry_aggregation: industryAggregation,
    earnings_expectation: earningsExpectation,
    macro_calendar: macroCalendar,
    intraday_data: intradayData,
    data_quality_summary: dataQualitySummary,
    quant_auto_fetch: quantAutoFetch,
    news_sentiment_summary: newsSentimentSummary,
    northbound_flow: northboundFlowReport,
    margin_trading: marginTradingReport,
    dragon_tiger: dragonTigerReport,
    institution_holding: institutionHoldingReport,
    news: newsData,
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
        stock_event_count: stockEvents.length,
        financial_enhanced: enhancedFinancial,
        adjust_factor_count: adjustFactors.length,
        corporate_action_count: corporateActions.length,
        industry_aggregation_count: industryAggregation.length,
        earnings_expectation_count: earningsExpectation.length,
        macro_calendar_count: macroCalendar.length,
        intraday_count: intradayData.length,
        data_quality_summary: dataQualitySummary,
        quant_auto_fetch: quantAutoFetch,
        news_sentiment_summary: newsSentimentSummary,
        northbound_flow_count: northboundFlowReport.length,
        margin_trading_count: marginTradingReport.length,
        dragon_tiger_count: dragonTigerReport.length,
        institution_holding_count: institutionHoldingReport.length,
        news_count: newsData.length,
        search_rounds: searchLogsData.length
      }
    },
    analysts: aiAnalysis ? ['AI 深度分析引擎 (Claude)'] : ['现场执行引擎'],
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
    stock_events: stockEvents,
    financial_enhanced: enhancedFinancial,
    adjust_factors: adjustFactors,
    corporate_actions: corporateActions,
    industry_aggregation: industryAggregation,
    earnings_expectation: earningsExpectation,
    macro_calendar: macroCalendar,
    intraday_data: intradayData,
    data_quality_summary: dataQualitySummary,
    quant_auto_fetch: quantAutoFetch,
    news_sentiment_summary: newsSentimentSummary,
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
      },
      $push: {
        logs: {
          at: new Date(),
          text: '检测到页面中断，执行停止。'
        }
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
    logs: [{ at: now, text: `创建现场任务：${symbol}` }],
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
      },
      $push: {
        logs: {
          at: now,
          text: '用户手动停止任务。'
        }
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
      },
      $push: {
        logs: {
          at: now,
          text: '页面关闭，任务自动停止。'
        }
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
      },
      $push: {
        logs: {
          at: now,
          text: reason || '用户手动标记任务失败。'
        }
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
        },
        $push: {
          logs: {
            at: now,
            text: '超时未收到页面心跳，任务停止。'
          }
        }
      }
    )
    const stopped = await executions.findOne({ _id: execution._id })
    return stopped
  }

  const now = new Date()
  const logs = [...(execution.logs || [])]
  const context = { ...(execution.context || {}) }
  let nextStep = execution.step
  let nextStatus: ExecutionStatus = execution.status
  let resultPayload = execution.result || undefined
  let reportId = execution.report_id

  if (execution.step === 0) {
    const valid = execution.symbol.length >= 4
    logs.push({ at: now, text: valid ? '股票代码校验通过。' : '股票代码校验失败。' })
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
    // A 股自动拉取最新行情数据
    const market = inferMarketFromCode(execution.symbol)
    if (market === 'A股') {
      try {
        const fetchResult = await fetchAStockData(execution.symbol)
        if (fetchResult.success) {
          logs.push({ at: now, text: `已从东方财富拉取最新数据：${fetchResult.message}` })
        } else {
          logs.push({ at: now, text: `在线拉取失败（${fetchResult.message}），将使用数据库已有数据` })
        }
      } catch {
        logs.push({ at: now, text: '在线数据拉取异常，将使用数据库已有数据' })
      }
    }

    const basic = await loadStockBasic(execution.symbol)
    context.basic = basic
    logs.push({ at: now, text: `已加载基础信息：${basic.name}` })
    nextStep += 1
  } else if (execution.step === 2) {
    const quote = await loadQuotePack(execution.symbol)
    context.quote = quote
    logs.push({ at: now, text: `已加载行情数据：样本 ${quote.samples}，阶段变化 ${quote.changePct.toFixed(2)}%` })
    nextStep += 1
  } else if (execution.step === 3) {
    const financial = await loadFundamentals(execution.symbol)
    context.financial = financial
    logs.push({ at: now, text: `已加载财务数据：ROE ${financial.roe.toFixed(2)}%，PE ${financial.pe.toFixed(2)}` })
    nextStep += 1
  } else if (execution.step === 4) {
    const basic = context.basic as { name: string; industry: string }
    
    let searchState = (context.search_state as SearchState | undefined) || initSearchState()
    
    if (searchState.phase === 'search') {
      const result = await executeOneSearchRound(searchState, basic.name, execution.symbol, basic.industry)
      searchState = result.state
      logs.push({ at: now, text: result.log })
      
      if (result.done) {
        context.news = searchState.news
        context.read_pages = searchState.readPages
        context.search_logs = searchState.searchLogs
        context.search_state = undefined
        logs.push({ at: now, text: `新闻搜索完成：共收集 ${searchState.news.length} 条资讯` })
        nextStep += 1
      } else {
        context.search_state = searchState
      }
    } else if (searchState.phase === 'decide') {
      const result = await executeDecideRound(searchState, basic.name, execution.symbol, basic.industry)
      searchState = result.state
      logs.push({ at: now, text: result.log })

      if (result.done) {
        context.news = searchState.news
        context.read_pages = searchState.readPages
        context.search_logs = searchState.searchLogs
        context.search_state = undefined
        logs.push({ at: now, text: `新闻搜索完成：共收集 ${searchState.news.length} 条资讯，深度阅读 ${searchState.readPages.length} 个网页` })
        nextStep += 1
      } else {
        context.search_state = searchState
      }
    } else if (searchState.phase === 'read') {
      const result = await executeOneReadRound(searchState, basic.name, execution.symbol, basic.industry)
      searchState = result.state
      logs.push({ at: now, text: result.log })
      
      if (result.done) {
        context.news = searchState.news
        context.read_pages = searchState.readPages
        context.search_logs = searchState.searchLogs
        context.search_state = undefined
        logs.push({ at: now, text: `新闻搜索完成：共收集 ${searchState.news.length} 条资讯，深度阅读 ${searchState.readPages.length} 个网页` })
        nextStep += 1
      } else {
        context.search_state = searchState
      }
    } else {
      context.news = searchState.news
      context.read_pages = searchState.readPages
      context.search_logs = searchState.searchLogs
      context.search_state = undefined
      nextStep += 1
    }
  } else if (execution.step === 5) {
    const quote = context.quote as { changePct: number }
    const financial = context.financial as { roe: number; pe: number; pb: number }
    const basic = context.basic as { industry: string }
    const decision = makeDecision(quote.changePct, financial.roe, financial.pe, financial.pb)
    context.decision = decision
    logs.push({ at: now, text: `基础研判：${decision.action}（置信度 ${decision.confidence}%）` })

    // 加载K线历史数据
    const klineData = await loadKlineHistory(execution.symbol, 60)
    context.kline_history = klineData
    logs.push({ at: now, text: `已加载 ${klineData.length} 条K线历史数据` })

    const lastKlineDate = klineData[klineData.length - 1]?.time || ''

    // 自动拉取增强数据（缓存优先，缺失才调外部接口）
    logs.push({ at: now, text: '正在检查并拉取增强数据...' })
    const quantFetchResult = await fetchAllQuantData({
      symbol: execution.symbol,
      market: execution.market,
      industry: basic.industry || ''
    }).catch(() => ({ success: false, message: '增强数据拉取异常', results: {} }))
    logs.push({ at: now, text: quantFetchResult.message })

    const [
      nextTradingDays,
      indexBenchmarks,
      fundFlow,
      stockEvents,
      enhancedFinancial,
      newsSentiment,
      adjustFactors,
      corporateActions,
      industryAggregation,
      earningsExpectation,
      macroCalendar,
      dataQuality,
      intradayData,
      northboundFlowData,
      marginTradingData,
      dragonTigerData,
      institutionHoldingData
    ] = await Promise.all([
      loadNextTradingDays(lastKlineDate, execution.market, 10).catch(() => []),
      loadIndexBenchmarks(lastKlineDate, execution.market, 60).catch(() => []),
      loadFundFlow(execution.symbol, 30).catch(() => []),
      loadStockEvents(execution.symbol, 50).catch(() => []),
      loadEnhancedFinancial(execution.symbol).catch(() => null),
      loadNewsSentiment(execution.symbol, 50).catch(() => []),
      loadAdjustFactors(execution.symbol, 30).catch(() => []),
      loadCorporateActions(execution.symbol, 30).catch(() => []),
      loadIndustryAggregation(basic.industry || '', 20).catch(() => []),
      loadEarningsExpectation(execution.symbol, 20).catch(() => []),
      loadMacroCalendar(40).catch(() => []),
      loadDataQualitySnapshot(execution.symbol, 30).catch(() => []),
      loadIntraday(execution.symbol, '1', 180).catch(() => []),
      loadNorthboundFlow(30).catch(() => []),
      loadMarginTrading(execution.symbol, 30).catch(() => []),
      loadDragonTiger(execution.symbol, 20).catch(() => []),
      loadInstitutionHolding(execution.symbol, 10).catch(() => [])
    ])

    context.next_trading_days = nextTradingDays
    context.index_benchmarks = indexBenchmarks
    context.fund_flow = fundFlow
    context.stock_events = stockEvents
    context.financial_enhanced = enhancedFinancial
    context.news_sentiment_summary = summarizeNewsSentiment(newsSentiment)
    context.adjust_factors = adjustFactors
    context.corporate_actions = corporateActions
    context.industry_aggregation = industryAggregation
    context.earnings_expectation = earningsExpectation
    context.macro_calendar = macroCalendar
    context.data_quality_summary = summarizeDataQuality(dataQuality)
    context.intraday_data = intradayData
    context.northbound_flow = northboundFlowData
    context.margin_trading = marginTradingData
    context.dragon_tiger = dragonTigerData
    context.institution_holding = institutionHoldingData

    logs.push({
      at: now,
      text: `增强数据加载完成：交易日历 ${nextTradingDays.length} 天，指数 ${summarizeBenchmarks(indexBenchmarks).length} 组，资金流 ${fundFlow.length} 条，事件 ${stockEvents.length} 条，复权 ${adjustFactors.length} 条，行业 ${industryAggregation.length} 条，业绩预期 ${earningsExpectation.length} 条，分时 ${intradayData.length} 条，北向资金 ${northboundFlowData.length} 条，融资融券 ${marginTradingData.length} 条，龙虎榜 ${dragonTigerData.length} 条，机构持仓 ${institutionHoldingData.length} 条`
    })

    // 调用AI深度分析（耗时较长，先刷新updated_at防止被标记为过期）
    await executions.updateOne(
      { _id: execution._id },
      { $set: { updated_at: new Date(), logs }, $currentDate: {} }
    )
    logs.push({ at: now, text: '正在调用 AI 进行深度分析与K线预测...' })
    const aiResult = await runAIAnalysis(
      { ...execution, context, logs } as ExecutionDoc,
      klineData
    )

    if (aiResult) {
      context.ai_analysis = aiResult
      logs.push({ at: now, text: `AI 分析完成：预测 ${aiResult.predicted_kline.length} 日K线，置信度 ${aiResult.ai_confidence}%` })
    } else {
      context.ai_analysis = null
      logs.push({ at: now, text: 'AI 分析未启用或调用失败，将使用基础研判结果' })
    }

    nextStep += 1
  } else if (execution.step === 6) {
    logs.push({ at: now, text: '正在生成分析报告...' })

    const report = await buildReport({
      ...execution,
      step: nextStep,
      context,
      logs
    })

    reportId = report.report_id
    resultPayload = report
    nextStatus = 'completed'
    nextStep += 1
    logs.push({ at: now, text: report.ai_powered ? '深度AI分析报告已生成，含K线预测。' : '基础分析报告已生成。' })

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
        updated_at: now
      },
      $push: {
        logs: {
          $each: logs.slice((execution.logs || []).length)
        }
      }
    }
  )

  return executions.findOne({ _id: execution._id })
}
