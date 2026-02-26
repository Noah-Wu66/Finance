import { getDb } from '@/lib/db'
import { hasMairuiLicence, mairuiApi } from '@/lib/mairui-data'

const FRESHNESS_MS = 30 * 60 * 1000

function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return [value as T]
  return []
}

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, '')
}

function ensureCodeWithMarket(code: string): string {
  const normalized = String(code || '').trim().toUpperCase()
  if (/\.(SH|SZ|BJ)$/i.test(normalized)) return normalized
  const raw = normalizeCode(normalized)
  if (raw.startsWith('6') || raw.startsWith('9')) return `${raw}.SH`
  if (raw.startsWith('8') || raw.startsWith('4')) return `${raw}.BJ`
  return `${raw}.SZ`
}

function firstNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (row[key] != null) {
      const n = Number(row[key])
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

function firstString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim()
    if (value) return value
  }
  return ''
}

async function isFresh(collection: string, query: Record<string, unknown>): Promise<boolean> {
  const db = await getDb()
  const doc = await db.collection(collection).findOne(query, { sort: { updated_at: -1 }, projection: { updated_at: 1 } })
  if (!doc?.updated_at) return false
  return Date.now() - new Date(doc.updated_at as string | Date).getTime() < FRESHNESS_MS
}

function ensureMairui(): { ok: true } | { ok: false; message: string } {
  if (!hasMairuiLicence()) return { ok: false, message: '未配置 MAIRUI_LICENCE' }
  return { ok: true }
}

export async function fetchTradingCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('trading_calendar', { market: 'SSE' })) {
    return { success: true, message: '交易日历缓存有效', count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsindex.history('000001.SH', 'd', { lt: 90 }))
    if (rows.length === 0) return { success: false, message: '交易日历无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const tradeDates = new Set<string>()
    for (const row of rows) {
      const date = toYmd(row.t || row.date)
      if (date) tradeDates.add(date)
    }

    const today = todayYmd()
    const minDate = daysAgoYmd(45)
    const ops = Array.from(tradeDates)
      .filter((date) => date >= minDate && date <= today)
      .map((date) => ({
        updateOne: {
          filter: { market: 'SSE', date },
          update: {
            $set: { market: 'SSE', date, is_trading_day: 1, source: 'mairui', updated_at: now },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }))

    if (ops.length > 0) {
      await db.collection('trading_calendar').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `交易日历已更新 ${ops.length} 天`, count: ops.length }
  } catch (err) {
    return { success: false, message: `交易日历拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchIndexDaily(indexCode = '000300', days = 120): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('index_daily', { index_code: indexCode })) {
    return { success: true, message: `指数 ${indexCode} 缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsindex.history(ensureCodeWithMarket(indexCode), 'd', { lt: days }))
    if (rows.length === 0) return { success: false, message: '指数K线无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.t || row.date)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { index_code: indexCode, trade_date: tradeDate },
            update: {
              $set: {
                index_code: indexCode,
                trade_date: tradeDate,
                open: toNum(row.o),
                close: toNum(row.c),
                high: toNum(row.h),
                low: toNum(row.l),
                volume: toNum(row.v),
                pct_chg: toNum(row.pc),
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('index_daily').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `指数 ${indexCode} 已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `指数K线拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchFundFlow(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_fund_flow', { symbol: code })) {
    return { success: true, message: `${code} 资金流缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsstock.historyTransaction(symbol, { lt: 30 }))
    if (rows.length === 0) return { success: false, message: '资金流无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.t || row.date || row.rq)
        if (!tradeDate) return null
        const mainInflow = firstNumber(row, ['zljlr', 'jlr', 'main_inflow', 'f62'])
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                main_inflow: mainInflow == null ? 0 : mainInflow,
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_fund_flow').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 资金流已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `资金流拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchIndustryAggregation(industry: string): Promise<{ success: boolean; message: string; count: number }> {
  if (!industry) return { success: false, message: '行业名为空', count: 0 }
  if (await isFresh('industry_aggregation', { industry_name: industry })) {
    return { success: true, message: `行业 ${industry} 缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const concepts = asArray<Record<string, unknown>>(await mairuiApi.hszg.list())
    const hit = concepts.find((row) => {
      const name = firstString(row, ['name', 'mc'])
      return name === industry || name.includes(industry) || industry.includes(name)
    })
    if (!hit) return { success: false, message: `未找到行业概念 ${industry}`, count: 0 }

    const conceptCode = firstString(hit, ['code', 'dm'])
    if (!conceptCode) return { success: false, message: `行业 ${industry} 缺少概念代码`, count: 0 }

    const members = asArray<Record<string, unknown>>(await mairuiApi.hszg.gg(conceptCode))
    const stockCodes = members
      .map((row) => firstString(row, ['dm', 'code']))
      .filter(Boolean)
      .slice(0, 300)
    if (stockCodes.length === 0) return { success: false, message: `行业 ${industry} 无成分股`, count: 0 }

    const quotes = asArray<Record<string, unknown>>(await mairuiApi.hsrl.ssjyMore(stockCodes))
    const validQuotes = quotes.filter((row) => firstString(row, ['dm', 'code']))

    const totalMainInflow = validQuotes.reduce((sum, row) => sum + (firstNumber(row, ['zljlr', 'jlr', 'main_inflow', 'f62']) || 0), 0)
    const totalPct = validQuotes.reduce((sum, row) => sum + (firstNumber(row, ['pc', 'pct_chg', 'f3']) || 0), 0)
    const totalAmount = validQuotes.reduce((sum, row) => sum + (firstNumber(row, ['cje', 'a', 'amount', 'f6']) || 0), 0)
    const sentiment = validQuotes.length > 0 ? Number((totalPct / validQuotes.length).toFixed(4)) : 0

    const db = await getDb()
    const now = new Date()
    const tradeDate = todayYmd()
    await db.collection('industry_aggregation').updateOne(
      { industry_name: industry, trade_date: tradeDate },
      {
        $set: {
          industry_name: industry,
          trade_date: tradeDate,
          industry_main_inflow: totalMainInflow,
          industry_sentiment: sentiment,
          industry_heat: totalAmount,
          sample_count: validQuotes.length,
          source: 'mairui',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )

    return { success: true, message: `行业 ${industry} 聚合已更新`, count: validQuotes.length }
  } catch (err) {
    return { success: false, message: `板块资金流拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchEarningsExpectation(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('earnings_expectation', { symbol: code })) {
    return { success: true, message: `${code} 业绩预期缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.yjyg(symbol))
    if (rows.length === 0) return { success: false, message: '业绩预告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => {
      const announceDate = toYmd(row.pdate || row.date) || 'latest'
      const sourceType = firstString(row, ['type']) || 'forecast'
      return {
        updateOne: {
          filter: { symbol, announce_date: announceDate, source_type: sourceType },
          update: {
            $set: {
              symbol,
              announce_date: announceDate,
              source_type: sourceType,
              forecast_type: firstString(row, ['type', 'forecast_type']) || undefined,
              profit_change_pct: firstNumber(row, ['chg', 'pct', 'profit_change_pct']),
              eps: firstNumber(row, ['eps', 'old']),
              revenue: firstNumber(row, ['revenue', 'zysr']),
              net_profit: firstNumber(row, ['net_profit', 'jlr']),
              summary: firstString(row, ['abs', 'summary']) || undefined,
              source: 'mairui',
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    })

    if (ops.length > 0) {
      await db.collection('earnings_expectation').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 业绩预告已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `业绩预告拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchFinancialEnhanced(code: string): Promise<{ success: boolean; message: string }> {
  if (await isFresh('financial_enhanced', { symbol: code })) {
    return { success: true, message: `${code} 增强财务缓存有效` }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message }

  try {
    const symbol = normalizeCode(code)
    const [cwzbRaw, cashflowRaw] = await Promise.all([
      mairuiApi.hscp.cwzb(symbol),
      mairuiApi.hsstock.financial.cashflow(ensureCodeWithMarket(symbol), { lt: 1 })
    ])

    const cwzb = asArray<Record<string, unknown>>(cwzbRaw)[0] || {}
    const cashflow = asArray<Record<string, unknown>>(cashflowRaw)[0] || {}
    const reportPeriod = toYmd(cwzb.date || cashflow.date) || 'latest'

    const netProfit = firstNumber(cwzb, ['jlr', 'net_profit', 'parent_net_profit']) || 0
    const ocf = firstNumber(cashflow, ['jyxjll', 'operate_cashflow', 'net_cash_operate']) || 0

    const db = await getDb()
    const now = new Date()
    await db.collection('financial_enhanced').updateOne(
      { symbol, report_period: reportPeriod },
      {
        $set: {
          symbol,
          report_period: reportPeriod,
          profit_yoy: firstNumber(cwzb, ['jlzz', 'profit_yoy', 'jlrzz']),
          gross_margin: firstNumber(cwzb, ['mll', 'gross_margin']),
          debt_to_asset: firstNumber(cwzb, ['zcfzl', 'debt_to_asset']),
          operating_cashflow: ocf || undefined,
          ocf_to_profit: netProfit !== 0 ? Number((ocf / netProfit).toFixed(4)) : undefined,
          source: 'mairui',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )
    return { success: true, message: `${symbol} 增强财务已更新` }
  } catch (err) {
    return { success: false, message: `增强财务拉取失败: ${err instanceof Error ? err.message : '未知'}` }
  }
}

export async function fetchStockEvents(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_events', { symbol: code })) {
    return { success: true, message: `${code} 公告缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.ljgg(symbol))
    if (rows.length === 0) return { success: false, message: '公告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const title = firstString(row, ['title', 'name', 'ggmc'])
        const eventDate = toYmd(row.date || row.pdate || row.t) || todayYmd()
        if (!title) return null
        return {
          updateOne: {
            filter: { symbol, event_date: eventDate, title },
            update: {
              $set: {
                symbol,
                event_type: firstString(row, ['type', 'event_type']) || 'announcement',
                event_date: eventDate,
                title,
                impact: 'unknown',
                url: firstString(row, ['url', 'link']) || undefined,
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_events').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 公告已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `公告拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchMacroCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: '麦蕊官方接口未提供宏观日历，此项已跳过', count: 0 }
}

export async function fetchIntraday(code: string, period = '1'): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_intraday', { symbol: code, period })) {
    return { success: true, message: `${code} 分时缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const mairuiPeriod = period.endsWith('m') ? period : `${period}m`
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsstock.latest(ensureCodeWithMarket(symbol), mairuiPeriod, 'n', { lt: 120 }))
    if (rows.length === 0) return { success: false, message: '分时无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const datetime = String(row.t || row.datetime || '').trim()
        if (!datetime) return null
        return {
          updateOne: {
            filter: { symbol, datetime, period },
            update: {
              $set: {
                symbol,
                datetime,
                period,
                open: toNum(row.o),
                close: toNum(row.c),
                high: toNum(row.h),
                low: toNum(row.l),
                volume: toNum(row.v),
                amount: toNum(row.a),
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_intraday').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 分时已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `分时拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchNorthboundFlow(): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: '麦蕊官方接口未提供北向资金汇总，此项已跳过', count: 0 }
}

export async function fetchMarginTrading(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('margin_trading', { symbol: code })) {
    return { success: true, message: `${code} 融资融券缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsstock.financial.hm(ensureCodeWithMarket(symbol), { lt: 30 }))
    if (rows.length === 0) return { success: false, message: '融资融券无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.t || row.date || row.rq)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                margin_balance: firstNumber(row, ['rzye', 'margin_balance']) || 0,
                short_balance: firstNumber(row, ['rqye', 'short_balance']) || 0,
                margin_buy: firstNumber(row, ['rzmre', 'margin_buy']) || 0,
                short_sell: firstNumber(row, ['rqmcl', 'short_sell']) || 0,
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('margin_trading').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 融资融券已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `融资融券拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchDragonTiger(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('dragon_tiger', { symbol: code })) {
    return { success: true, message: `${code} 龙虎榜缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.ljds(symbol))
    if (rows.length === 0) return { success: false, message: '龙虎榜无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.date || row.t || row.rq)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                reason: firstString(row, ['reason', 'type', 'name']),
                total_amount: firstNumber(row, ['amount', 'total_amount']) || 0,
                buy_amount: firstNumber(row, ['buy_amount']) || 0,
                sell_amount: firstNumber(row, ['sell_amount']) || 0,
                net_amount: firstNumber(row, ['net_amount', 'jlr']) || 0,
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('dragon_tiger').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 龙虎榜已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `龙虎榜拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchInstitutionHolding(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('institution_holding', { symbol: code })) {
    return { success: true, message: `${code} 机构持仓缓存有效`, count: 0 }
  }

  const licence = ensureMairui()
  if (!licence.ok) return { success: false, message: licence.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hscp.gdbh(symbol))
    if (rows.length === 0) return { success: false, message: '机构持仓无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const reportDate = toYmd(row.date || row.rdate || row.t)
        if (!reportDate) return null
        return {
          updateOne: {
            filter: { symbol, report_date: reportDate },
            update: {
              $set: {
                symbol,
                report_date: reportDate,
                holder_num: firstNumber(row, ['gdhs', 'holder_num']) || 0,
                holder_change: firstNumber(row, ['change', 'holder_change']) || 0,
                source: 'mairui',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      })
      .filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('institution_holding').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${symbol} 机构持仓已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `机构持仓拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

export async function fetchAllQuantData(params: {
  symbol: string
  market: string
  industry: string
}): Promise<{ success: boolean; message: string; results: Record<string, { success: boolean; message: string }> }> {
  const { symbol, market, industry } = params

  const indexCodes = market.includes('A') ? ['000300', '000001', '399006'] : ['000300']

  const [
    calendarResult,
    ...indexResults
  ] = await Promise.all([
    fetchTradingCalendar(),
    ...indexCodes.map((ic) => fetchIndexDaily(ic, 120))
  ])

  const [
    northboundResult,
    fundFlowResult,
    industryResult,
    earningsResult,
    financialResult,
    eventsResult,
    macroResult,
    intradayResult,
    marginResult,
    dragonTigerResult,
    institutionResult
  ] = await Promise.all([
    fetchNorthboundFlow(),
    fetchFundFlow(symbol),
    fetchIndustryAggregation(industry),
    fetchEarningsExpectation(symbol),
    fetchFinancialEnhanced(symbol),
    fetchStockEvents(symbol),
    fetchMacroCalendar(),
    fetchIntraday(symbol, '1'),
    fetchMarginTrading(symbol),
    fetchDragonTiger(symbol),
    fetchInstitutionHolding(symbol)
  ])

  const results: Record<string, { success: boolean; message: string }> = {
    trading_calendar: calendarResult,
    northbound_flow: northboundResult,
    fund_flow: fundFlowResult,
    industry_aggregation: industryResult,
    earnings_expectation: earningsResult,
    financial_enhanced: financialResult,
    stock_events: eventsResult,
    macro_calendar: macroResult,
    intraday: intradayResult,
    margin_trading: marginResult,
    dragon_tiger: dragonTigerResult,
    institution_holding: institutionResult
  }
  for (let i = 0; i < indexCodes.length; i++) {
    results[`index_${indexCodes[i]}`] = indexResults[i]
  }

  const allOk = Object.values(results).every((r) => r.success)
  const failedCount = Object.values(results).filter((r) => !r.success).length
  const msg = allOk
    ? '所有增强数据已就绪'
    : `${failedCount} 项数据拉取失败或无数据，其余已就绪`

  return { success: true, message: msg, results }
}
