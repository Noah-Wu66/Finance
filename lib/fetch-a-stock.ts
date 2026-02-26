import { getDb } from '@/lib/db'
import {
  fetchAStockDaily as fetchAStockDailyFromMairui,
  fetchAStockExtendedSnapshot,
  fetchAStockFinancialSummary,
  fetchAStockProfileSummary,
  fetchAStockQuote as fetchAStockQuoteFromMairui,
  hasMairuiLicence
} from '@/lib/mairui-data'

function normalizeSymbol(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, '')
}

export async function fetchRealtimeQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  return fetchAStockQuoteFromMairui(normalizeSymbol(code))
}

export async function fetchDailyKline(code: string, days = 60): Promise<{
  success: boolean
  message: string
  count: number
  stockName?: string
}> {
  return fetchAStockDailyFromMairui(normalizeSymbol(code), days)
}

export async function fetchFinancialData(code: string): Promise<{
  success: boolean
  message: string
  data?: { roe: number; revenueGrowth: number; pe: number; pb: number; reportDate: string }
}> {
  return fetchAStockFinancialSummary(normalizeSymbol(code))
}

export async function fetchStockProfile(code: string): Promise<{
  success: boolean
  message: string
  data?: { industry: string; industryDetail: string }
}> {
  return fetchAStockProfileSummary(normalizeSymbol(code))
}

export async function fetchAStockData(code: string): Promise<{
  success: boolean
  message: string
  realtime: { success: boolean; message: string }
  kline: { success: boolean; message: string; count: number }
  financial: { success: boolean; message: string }
  profile: { success: boolean; message: string }
  extended: { success: boolean; message: string }
}> {
  const normalized = normalizeSymbol(code)

  if (!/^[0-9]{6}$/.test(normalized)) {
    return {
      success: false,
      message: `${code} 不是有效的 A 股代码（需要 6 位数字）`,
      realtime: { success: false, message: '跳过' },
      kline: { success: false, message: '跳过', count: 0 },
      financial: { success: false, message: '跳过' },
      profile: { success: false, message: '跳过' },
      extended: { success: false, message: '跳过' }
    }
  }

  if (!hasMairuiLicence()) {
    return {
      success: false,
      message: '未配置 MAIRUI_LICENCE，无法同步',
      realtime: { success: false, message: '未配置 MAIRUI_LICENCE' },
      kline: { success: false, message: '未配置 MAIRUI_LICENCE', count: 0 },
      financial: { success: false, message: '未配置 MAIRUI_LICENCE' },
      profile: { success: false, message: '未配置 MAIRUI_LICENCE' },
      extended: { success: false, message: '未配置 MAIRUI_LICENCE' }
    }
  }

  const FRESHNESS_MS = 10 * 60 * 1000
  const db = await getDb()
  const latestQuote = await db.collection('stock_quotes').findOne(
    {
      symbol: normalized,
      data_source: { $in: ['mairui_a_stock_daily', 'mairui_a_stock'] }
    },
    { sort: { updated_at: -1 }, projection: { updated_at: 1 } }
  )
  if (latestQuote?.updated_at && Date.now() - new Date(latestQuote.updated_at as string | Date).getTime() < FRESHNESS_MS) {
    return {
      success: true,
      message: `${normalized} 数据在 10 分钟内已拉取过，跳过重复请求`,
      realtime: { success: true, message: '使用缓存数据' },
      kline: { success: true, message: '使用缓存数据', count: 0 },
      financial: { success: true, message: '使用缓存数据' },
      profile: { success: true, message: '使用缓存数据' },
      extended: { success: true, message: '使用缓存数据' }
    }
  }

  const [realtime, kline, financial, profile, extendedRaw] = await Promise.all([
    fetchRealtimeQuote(normalized),
    fetchDailyKline(normalized, 60),
    fetchFinancialData(normalized),
    fetchStockProfile(normalized),
    fetchAStockExtendedSnapshot(normalized)
  ])
  const extended = { success: extendedRaw.success, message: extendedRaw.message }

  const now = new Date()
  const basicInfoPatch: Record<string, unknown> = {
    symbol: normalized,
    code: normalized,
    market: 'A股',
    source: 'mairui',
    updated_at: now
  }

  if (realtime.success && realtime.data) {
    const d = realtime.data
    if (d.name) basicInfoPatch.name = d.name
    if (d.industry) basicInfoPatch.industry = d.industry
    if (d.total_mv) basicInfoPatch.total_mv = d.total_mv
    if (d.pe) basicInfoPatch.pe = d.pe
    if (d.pb) basicInfoPatch.pb = d.pb
  }

  if (kline.success && kline.stockName && !basicInfoPatch.name) {
    basicInfoPatch.name = kline.stockName
  }

  if (financial.success && financial.data) {
    basicInfoPatch.roe = financial.data.roe
    if (financial.data.pe) basicInfoPatch.pe = financial.data.pe
    if (financial.data.pb) basicInfoPatch.pb = financial.data.pb
    basicInfoPatch.revenue_yoy = financial.data.revenueGrowth
  }

  if (profile.success && profile.data) {
    if (profile.data.industry) basicInfoPatch.industry = profile.data.industry
    basicInfoPatch.industry_detail = profile.data.industryDetail
  }

  await db.collection('stock_basic_info').updateOne(
    { symbol: normalized },
    { $set: basicInfoPatch, $setOnInsert: { created_at: now } },
    { upsert: true }
  )

  const success = kline.success
  const parts: string[] = []
  if (kline.success) parts.push(kline.message)
  if (realtime.success) parts.push(realtime.message)
  if (financial.success) parts.push(financial.message)
  if (profile.success) parts.push(profile.message)
  if (extended.success) parts.push(extended.message)

  const message = success
    ? `${normalized} 数据拉取完成：${parts.join('；')}`
    : `${normalized} 数据拉取失败：K线=${kline.message}`

  return {
    success,
    message,
    realtime,
    kline,
    financial,
    profile,
    extended
  }
}
