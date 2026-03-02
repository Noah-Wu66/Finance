import { getDb } from '@/lib/db'
import { hasMairuiLicence, tusharePost, toTsCode, todayYmd, daysAgoYmd } from '@/lib/mairui-data'
import { TUSHARE_CASHFLOW_FIELDS, TUSHARE_FINA_INDICATOR_FIELDS } from '@/lib/tushare-field-sets'

const FRESHNESS_MS = 30 * 60 * 1000

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

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, '')
}

function firstString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(row[key] ?? '').trim()
    if (value) return value
  }
  return ''
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

function averageDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a !== undefined && b !== undefined) return Number(((a + b) / 2).toFixed(4))
  return a ?? b
}

async function isFresh(collection: string, query: Record<string, unknown>): Promise<boolean> {
  const db = await getDb()
  const doc = await db.collection(collection).findOne(query, { sort: { updated_at: -1 }, projection: { updated_at: 1 } })
  if (!doc?.updated_at) return false
  return Date.now() - new Date(doc.updated_at as string | Date).getTime() < FRESHNESS_MS
}

function ensureTushare(): { ok: true } | { ok: false; message: string } {
  if (!hasMairuiLicence()) return { ok: false, message: '未配置 TUSHARE_TOKEN' }
  return { ok: true }
}

// ─── 交易日历 ─────────────────────────────────────────────────────────────────

export async function fetchTradingCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('trading_calendar', { market: 'SSE' })) {
    return { success: true, message: '交易日历缓存有效', count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const startDate = daysAgoYmd(60)
    const rows = await tusharePost(
      'trade_cal',
      { exchange: 'SSE', start_date: startDate, end_date: todayYmd() },
      ['exchange', 'cal_date', 'is_open', 'pretrade_date']
    )
    if (rows.length === 0) return { success: false, message: '交易日历无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { market: 'SSE', date: String(row.cal_date) },
        update: {
          $set: {
            market: 'SSE',
            date: String(row.cal_date),
            is_trading_day: toNum(row.is_open),
            source: 'tushare',
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) {
      await db.collection('trading_calendar').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `交易日历已更新 ${ops.length} 天`, count: ops.length }
  } catch (err) {
    return { success: false, message: `交易日历拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 指数日线 ─────────────────────────────────────────────────────────────────

export async function fetchIndexDaily(indexCode = '000300', days = 120): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('index_daily', { index_code: indexCode })) {
    return { success: true, message: `指数 ${indexCode} 缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  // Tushare 指数代码格式：000300.SH / 399006.SZ / 000001.SH
  const tsIndexCode = toTsCode(indexCode)

  try {
    const rows = await tusharePost(
      'index_daily',
      { ts_code: tsIndexCode, start_date: daysAgoYmd(days + 10), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'close', 'open', 'high', 'low', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
    )
    if (rows.length === 0) return { success: false, message: '指数K线无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { index_code: indexCode, trade_date: tradeDate },
            update: {
              $set: {
                index_code: indexCode,
                trade_date: tradeDate,
                open: toNum(row.open),
                close: toNum(row.close),
                high: toNum(row.high),
                low: toNum(row.low),
                volume: toNum(row.vol),
                pct_chg: toNum(row.pct_chg),
                change: toNum(row.change),
                source: 'tushare',
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
      await db.collection('index_daily').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `指数 ${indexCode} 已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `指数K线拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 个股资金流 ───────────────────────────────────────────────────────────────

export async function fetchFundFlow(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (await isFresh('stock_fund_flow', { symbol })) {
    return { success: true, message: `${symbol} 资金流缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'moneyflow',
      { ts_code: tsCode, start_date: daysAgoYmd(30), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'buy_sm_vol', 'sell_sm_vol', 'buy_md_vol', 'sell_md_vol',
        'buy_lg_vol', 'sell_lg_vol', 'buy_elg_vol', 'sell_elg_vol',
        'buy_sm_amount', 'sell_sm_amount', 'buy_md_amount', 'sell_md_amount',
        'buy_lg_amount', 'sell_lg_amount', 'buy_elg_amount', 'sell_elg_amount',
        'net_mf_vol', 'net_mf_amount']
    )
    if (rows.length === 0) return { success: false, message: '资金流无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) return null
        const mainInflow = toNum(row.buy_elg_amount) - toNum(row.sell_elg_amount) +
          toNum(row.buy_lg_amount) - toNum(row.sell_lg_amount)
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                main_inflow: mainInflow,
                buy_elg_amount: toNum(row.buy_elg_amount),
                sell_elg_amount: toNum(row.sell_elg_amount),
                buy_lg_amount: toNum(row.buy_lg_amount),
                sell_lg_amount: toNum(row.sell_lg_amount),
                buy_md_amount: toNum(row.buy_md_amount),
                sell_md_amount: toNum(row.sell_md_amount),
                buy_sm_amount: toNum(row.buy_sm_amount),
                sell_sm_amount: toNum(row.sell_sm_amount),
                buy_elg_vol: toNum(row.buy_elg_vol),
                sell_elg_vol: toNum(row.sell_elg_vol),
                buy_lg_vol: toNum(row.buy_lg_vol),
                sell_lg_vol: toNum(row.sell_lg_vol),
                buy_md_vol: toNum(row.buy_md_vol),
                sell_md_vol: toNum(row.sell_md_vol),
                buy_sm_vol: toNum(row.buy_sm_vol),
                sell_sm_vol: toNum(row.sell_sm_vol),
                net_mf_vol: toNum(row.net_mf_vol),
                net_mf_amount: toNum(row.net_mf_amount),
                source: 'tushare',
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
      await db.collection('stock_fund_flow').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `${symbol} 资金流已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `资金流拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 行业聚合 ─────────────────────────────────────────────────────────────────

export async function fetchIndustryAggregation(industry: string): Promise<{ success: boolean; message: string; count: number }> {
  if (!industry) return { success: false, message: '行业名为空', count: 0 }
  if (await isFresh('industry_aggregation', { industry_name: industry })) {
    return { success: true, message: `行业 ${industry} 缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    // 按官方文档改为 stock_basic 的行业字段聚合，避免使用已下线的 concept/concept_detail
    const keyword = industry.trim()
    const basicRows = await tusharePost(
      'stock_basic',
      { list_status: 'L', exchange: '' },
      ['ts_code', 'industry']
    )

    const matchedCodes = basicRows
      .filter((row) => {
        const rowIndustry = firstString(row, ['industry'])
        if (!rowIndustry) return false
        return rowIndustry === keyword || rowIndustry.includes(keyword) || keyword.includes(rowIndustry)
      })
      .map((row) => String(row.ts_code || '').trim().toUpperCase())
      .filter((code) => code.length > 0)

    if (matchedCodes.length === 0) {
      return { success: false, message: `未找到行业 ${industry} 的股票列表`, count: 0 }
    }

    // 按交易日拉全市场日线，再按行业成分过滤
    const dailyRows = await tusharePost(
      'daily',
      { trade_date: todayYmd() },
      ['ts_code', 'trade_date', 'pct_chg', 'amount']
    )

    const codeSet = new Set(matchedCodes)
    const validQuotes = dailyRows.filter((row) => codeSet.has(String(row.ts_code || '').trim().toUpperCase()))
    if (validQuotes.length === 0) {
      return { success: false, message: `行业 ${industry} 当日无行情数据`, count: 0 }
    }

    const totalPct = validQuotes.reduce((sum, row) => sum + toNum(row.pct_chg), 0)
    const totalAmount = validQuotes.reduce((sum, row) => sum + toNum(row.amount), 0)
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
          industry_main_inflow: 0,
          industry_sentiment: sentiment,
          industry_heat: totalAmount,
          sample_count: validQuotes.length,
          universe_count: matchedCodes.length,
          source: 'tushare',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )
    return {
      success: true,
      message: `行业 ${industry} 聚合已更新（样本 ${validQuotes.length}/${matchedCodes.length}）`,
      count: validQuotes.length
    }
  } catch (err) {
    return { success: false, message: `行业聚合拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 业绩预告 ─────────────────────────────────────────────────────────────────

export async function fetchEarningsExpectation(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (await isFresh('earnings_expectation', { symbol })) {
    return { success: true, message: `${symbol} 业绩预期缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'fina_forecast',
      { ts_code: tsCode },
      ['ts_code', 'end_date', 'type', 'net_profit_min', 'net_profit_max', 'eps_min', 'eps_max', 'reason']
    )
    if (rows.length === 0) return { success: false, message: '业绩预告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => {
      const announceDate = toYmd(row.ann_date || row.end_date) || 'latest'
      const sourceType = firstString(row, ['type']) || 'forecast'
      const pMin = hasValue(row.p_change_min) ? toNum(row.p_change_min) : undefined
      const pMax = hasValue(row.p_change_max) ? toNum(row.p_change_max) : undefined
      const netMin = hasValue(row.net_profit_min) ? toNum(row.net_profit_min) : undefined
      const netMax = hasValue(row.net_profit_max) ? toNum(row.net_profit_max) : undefined
      const lastParentNet = hasValue(row.last_parent_net) ? toNum(row.last_parent_net) : undefined
      const profitChangePct = averageDefined(pMin, pMax)
      const netProfit = averageDefined(netMin, netMax) ?? lastParentNet
      return {
        updateOne: {
          filter: { symbol, announce_date: announceDate, source_type: sourceType },
          update: {
            $set: {
              symbol,
              announce_date: announceDate,
              report_date: toYmd(row.end_date) || undefined,
              source_type: sourceType,
              forecast_type: firstString(row, ['type', 'forecast_type']) || undefined,
              p_change_min: pMin,
              p_change_max: pMax,
              profit_change_pct: profitChangePct,
              net_profit_min: netMin,
              net_profit_max: netMax,
              net_profit: netProfit,
              eps_min: hasValue(row.eps_min) ? toNum(row.eps_min) : undefined,
              eps_max: hasValue(row.eps_max) ? toNum(row.eps_max) : undefined,
              summary: firstString(row, ['reason', 'summary', 'change_reason']) || undefined,
              source: 'tushare',
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    })
    if (ops.length > 0) {
      await db.collection('earnings_expectation').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `${symbol} 业绩预告已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `业绩预告拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 增强财务 ─────────────────────────────────────────────────────────────────

export async function fetchFinancialEnhanced(code: string): Promise<{ success: boolean; message: string }> {
  const symbol = normalizeCode(code)
  if (await isFresh('financial_enhanced', { symbol })) {
    return { success: true, message: `${symbol} 增强财务缓存有效` }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message }

  try {
    const tsCode = toTsCode(symbol)
    const [finaRows, cashflowRows] = await Promise.all([
      tusharePost(
        'fina_indicator',
        { ts_code: tsCode },
        [...TUSHARE_FINA_INDICATOR_FIELDS]
      ),
      tusharePost(
        'cashflow',
        { ts_code: tsCode, report_type: '1' },
        [...TUSHARE_CASHFLOW_FIELDS]
      )
    ])

    const fina = finaRows[0] || {}
    const cashflow = cashflowRows[0] || {}
    const reportPeriod = toYmd(fina.end_date || cashflow.end_date) || 'latest'

    const netProfit = toNum(cashflow.net_profit)
    const ocf = toNum(cashflow.n_cashflow_act)

    const db = await getDb()
    const now = new Date()
    await db.collection('financial_enhanced').updateOne(
      { symbol, report_period: reportPeriod },
      {
        $set: {
          symbol,
          report_period: reportPeriod,
          profit_yoy: toNum(fina.netprofit_yoy) || undefined,
          revenue_yoy: toNum(fina.revenue_yoy) || undefined,
          gross_margin: toNum(fina.grossprofit_margin) || undefined,
          debt_to_asset: toNum(fina.debt_to_assets) || undefined,
          current_ratio: toNum(fina.current_ratio) || undefined,
          operating_cashflow: ocf || undefined,
          ocf_to_profit: netProfit !== 0 ? Number((ocf / netProfit).toFixed(4)) : undefined,
          source: 'tushare',
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

// ─── 北向资金（moneyflow_hsgt）────────────────────────────────────────────────

export async function fetchNorthboundFlow(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('northbound_flow', { type: 'daily' })) {
    return { success: true, message: '北向资金缓存有效', count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const rows = await tusharePost(
      'moneyflow_hsgt',
      { start_date: daysAgoYmd(30), end_date: todayYmd() },
      ['trade_date', 'ggt_ss', 'ggt_sz', 'hgt', 'sgt', 'north_money', 'south_money']
    )
    if (rows.length === 0) return { success: false, message: '北向资金无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { trade_date: String(row.trade_date) },
        update: {
          $set: {
            type: 'daily',
            trade_date: String(row.trade_date),
            net_buy: toNum(row.north_money),
            sh_net_buy: toNum(row.hgt),
            sz_net_buy: toNum(row.sgt),
            north_money: toNum(row.north_money),
            south_money: toNum(row.south_money),
            hgt: toNum(row.hgt),
            sgt: toNum(row.sgt),
            ggt_ss: toNum(row.ggt_ss),
            ggt_sz: toNum(row.ggt_sz),
            source: 'tushare',
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) {
      await db.collection('northbound_flow').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `北向资金已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `北向资金拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 融资融券明细（margin_detail，2000积分可用）──────────────────────────────

export async function fetchMarginTrading(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }

  if (await isFresh('margin_trading', { symbol })) {
    return { success: true, message: `${symbol} 融资融券缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'margin_detail',
      { ts_code: tsCode, start_date: daysAgoYmd(30), end_date: todayYmd() },
      ['trade_date', 'ts_code', 'name', 'rzye', 'rqye', 'rzmre', 'rqyl', 'rzche', 'rqchl', 'rqmcl', 'rzrqye']
    )
    if (rows.length === 0) return { success: false, message: '融资融券明细无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                margin_balance: toNum(row.rzye),
                margin_buy: toNum(row.rzmre),
                margin_repay: toNum(row.rzche),
                short_balance: toNum(row.rqye),
                short_volume: toNum(row.rqyl),
                short_repay: toNum(row.rqchl),
                short_sell: toNum(row.rqmcl),
                total_balance: toNum(row.rzrqye),
                source: 'tushare',
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
      await db.collection('margin_trading').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `${symbol} 融资融券明细已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `融资融券拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 龙虎榜（toplist，11000积分可用）──────────────────────────────────────────

export async function fetchDragonTiger(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }

  if (await isFresh('dragon_tiger', { symbol })) {
    return { success: true, message: `${symbol} 龙虎榜缓存有效`, count: 0 }
  }

  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'toplist',
      { ts_code: tsCode, start_date: daysAgoYmd(120), end_date: todayYmd() },
      ['trade_date', 'ts_code', 'name', 'close', 'pct_chg', 'turnover_rate', 'amount', 'buy', 'sell', 'net_buy']
    )
    if (rows.length === 0) return { success: false, message: '龙虎榜无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) return null
        const reason = firstString(row, ['reason']) || '龙虎榜'
        return {
          updateOne: {
            filter: { symbol, trade_date: tradeDate, reason },
            update: {
              $set: {
                symbol,
                trade_date: tradeDate,
                reason,
                total_amount: toNum(row.amount),
                buy_amount: toNum(row.buy),
                sell_amount: toNum(row.sell),
                dragon_amount: toNum(row.net_buy),
                net_amount: toNum(row.net_buy),
                close: toNum(row.close),
                pct_change: toNum(row.pct_chg),
                turnover_rate: toNum(row.turnover_rate),
                source: 'tushare',
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
      await db.collection('dragon_tiger').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `${symbol} 龙虎榜已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `龙虎榜拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 机构持仓（前十大流通股东）───────────────────────────────────────────────

export async function fetchInstitutionHolding(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }

  if (await isFresh('institution_holding', { symbol, holder_num: { $exists: true } })) {
    return { success: true, message: `${symbol} 机构持仓缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'top10_floatholders',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio', 'hold_change', 'hold_float_ratio', 'holder_type']
    )
    if (rows.length === 0) return { success: false, message: '前十大流通股东无数据', count: 0 }

    const grouped = new Map<string, { holders: Set<string>; totalHoldAmount: number; totalHoldRatio: number; sumHoldChange: number }>()
    for (const row of rows) {
      const reportDate = toYmd(row.end_date || row.ann_date)
      if (!reportDate) continue

      const holderName = firstString(row, ['holder_name'])
      const current = grouped.get(reportDate) || {
        holders: new Set<string>(),
        totalHoldAmount: 0,
        totalHoldRatio: 0,
        sumHoldChange: 0
      }

      if (holderName) current.holders.add(holderName)
      current.totalHoldAmount += toNum(row.hold_amount)
      current.totalHoldRatio += toNum(row.hold_ratio)
      current.sumHoldChange += toNum(row.hold_change)

      grouped.set(reportDate, current)
    }

    if (grouped.size === 0) return { success: false, message: '机构持仓无有效报告期', count: 0 }

    const reportDates = [...grouped.keys()].sort((a, b) => a.localeCompare(b))
    const db = await getDb()
    const now = new Date()
    const ops = reportDates.map((reportDate, idx) => {
      const current = grouped.get(reportDate)!
      const prev = idx > 0 ? grouped.get(reportDates[idx - 1]) : undefined
      const holderChange = prev
        ? Number((current.totalHoldRatio - prev.totalHoldRatio).toFixed(4))
        : 0

      return {
        updateOne: {
          filter: { symbol, report_date: reportDate },
          update: {
            $set: {
              symbol,
              report_date: reportDate,
              holder_num: current.holders.size,
              holder_change: holderChange,
              total_hold_amount: Number(current.totalHoldAmount.toFixed(2)),
              total_hold_ratio: Number(current.totalHoldRatio.toFixed(4)),
              sum_hold_change: Number(current.sumHoldChange.toFixed(4)),
              source: 'tushare',
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    })

    if (ops.length > 0) {
      await db.collection('institution_holding').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `${symbol} 机构持仓已更新 ${ops.length} 期`, count: ops.length }
  } catch (err) {
    return { success: false, message: `机构持仓拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 全量量化数据 ─────────────────────────────────────────────────────────────

export async function fetchAllQuantData(params: {
  symbol: string
  market: string
  industry: string
}): Promise<{ success: boolean; message: string; results: Record<string, { success: boolean; message: string }> }> {
  const { symbol, market, industry } = params

  const indexCodes = market.includes('A') ? ['000300', '000001', '399006'] : ['000300']

  const [calendarResult, ...indexResults] = await Promise.all([
    fetchTradingCalendar(),
    ...indexCodes.map((ic) => fetchIndexDaily(ic, 120))
  ])

  const [
    northboundResult,
    fundFlowResult,
    industryResult,
    earningsResult,
    financialResult,
    marginResult,
    dragonTigerResult,
    institutionResult
  ] = await Promise.all([
    fetchNorthboundFlow(),
    fetchFundFlow(symbol),
    fetchIndustryAggregation(industry),
    fetchEarningsExpectation(symbol),
    fetchFinancialEnhanced(symbol),
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
