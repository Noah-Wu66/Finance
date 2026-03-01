import { getDb } from '@/lib/db'
import { hasMairuiLicence, tusharePost, toTsCode, fromTsCode, todayYmd, daysAgoYmd } from '@/lib/mairui-data'

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
  if (await isFresh('stock_fund_flow', { symbol: code })) {
    return { success: true, message: `${code} 资金流缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'moneyflow',
      { ts_code: tsCode, start_date: daysAgoYmd(30), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'buy_sm_amount', 'sell_sm_amount', 'buy_md_amount', 'sell_md_amount',
        'buy_lg_amount', 'sell_lg_amount', 'buy_elg_amount', 'sell_elg_amount', 'net_mf_amount']
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
    // 先拉概念列表找到匹配板块
    const concepts = await tusharePost('concept', {}, ['code', 'name', 'src'])
    const hit = concepts.find((row) => {
      const name = firstString(row, ['name'])
      return name === industry || name.includes(industry) || industry.includes(name)
    })
    if (!hit) return { success: false, message: `未找到行业概念 ${industry}`, count: 0 }

    const conceptCode = firstString(hit, ['code'])
    if (!conceptCode) return { success: false, message: `行业 ${industry} 缺少概念代码`, count: 0 }

    // 拉该板块成分股
    const members = await tusharePost(
      'concept_detail',
      { concept_code: conceptCode },
      ['ts_code', 'name']
    )
    if (members.length === 0) return { success: false, message: `行业 ${industry} 无成分股`, count: 0 }

    // 拉每日指标
    const stockCodes = members.slice(0, 50).map((r) => String(r.ts_code))
    const dailyRows = await tusharePost(
      'daily',
      { ts_code: stockCodes.join(','), trade_date: todayYmd() },
      ['ts_code', 'trade_date', 'pct_chg', 'amount']
    )

    const validQuotes = dailyRows.filter((r) => r.ts_code)
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
          source: 'tushare',
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

// ─── 业绩预告 ─────────────────────────────────────────────────────────────────

export async function fetchEarningsExpectation(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('earnings_expectation', { symbol: code })) {
    return { success: true, message: `${code} 业绩预期缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'forecast',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'type', 'p_change_min', 'p_change_max', 'net_profit_min', 'net_profit_max', 'last_parent_net', 'summary', 'change_reason']
    )
    if (rows.length === 0) return { success: false, message: '业绩预告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => {
      const announceDate = toYmd(row.ann_date) || 'latest'
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
              p_change_min: toNum(row.p_change_min),
              p_change_max: toNum(row.p_change_max),
              net_profit_min: toNum(row.net_profit_min),
              net_profit_max: toNum(row.net_profit_max),
              summary: firstString(row, ['summary', 'change_reason']) || undefined,
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
  if (await isFresh('financial_enhanced', { symbol: code })) {
    return { success: true, message: `${code} 增强财务缓存有效` }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message }

  try {
    const symbol = normalizeCode(code)
    const tsCode = toTsCode(symbol)
    const [finaRows, cashflowRows] = await Promise.all([
      tusharePost(
        'fina_indicator',
        { ts_code: tsCode },
        ['ts_code', 'end_date', 'grossprofit_margin', 'debt_to_assets', 'netprofit_yoy', 'revenue_yoy', 'roe', 'current_ratio']
      ),
      tusharePost(
        'cashflow',
        { ts_code: tsCode, report_type: '1' },
        ['ts_code', 'end_date', 'n_cashflow_act', 'net_profit']
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

// ─── 公告（Tushare 5000积分才有，暂不支持）──────────────────────────────────

export async function fetchStockEvents(_code: string): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: 'Tushare 公告接口需5000积分，暂不支持', count: 0 }
}

// ─── 宏观日历 ─────────────────────────────────────────────────────────────────

export async function fetchMacroCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: 'Tushare 不提供宏观日历，此项已跳过', count: 0 }
}

// ─── 分钟线（5000积分，暂不支持）────────────────────────────────────────────

export async function fetchIntraday(_code: string, _period = '1'): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: 'Tushare 分钟线需5000积分，暂不支持', count: 0 }
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

// ─── 融资融券汇总（市场级别，非单股）────────────────────────────────────────

export async function fetchMarginTrading(_code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('margin_trading', { type: 'market_summary' })) {
    return { success: true, message: '融资融券汇总缓存有效', count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const rows = await tusharePost(
      'margin',
      { trade_date: todayYmd() },
      ['trade_date', 'exchange_id', 'rzye', 'rzmre', 'rzche', 'rqye', 'rqmcl', 'rzrqye']
    )
    if (rows.length === 0) return { success: false, message: '融资融券无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { trade_date: String(row.trade_date), exchange_id: String(row.exchange_id) },
        update: {
          $set: {
            type: 'market_summary',
            trade_date: String(row.trade_date),
            exchange_id: String(row.exchange_id),
            margin_balance: toNum(row.rzye),
            margin_buy: toNum(row.rzmre),
            short_balance: toNum(row.rqye),
            short_sell: toNum(row.rqmcl),
            total_balance: toNum(row.rzrqye),
            source: 'tushare',
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))
    if (ops.length > 0) {
      await db.collection('margin_trading').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `融资融券汇总已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `融资融券拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 龙虎榜（5000积分，暂不支持）────────────────────────────────────────────

export async function fetchDragonTiger(_code: string): Promise<{ success: boolean; message: string; count: number }> {
  return { success: false, message: 'Tushare 龙虎榜需5000积分，暂不支持', count: 0 }
}

// ─── 机构持仓（前十大流通股东）───────────────────────────────────────────────

export async function fetchInstitutionHolding(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('institution_holding', { symbol: code })) {
    return { success: true, message: `${code} 机构持仓缓存有效`, count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const symbol = normalizeCode(code)
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'top10_floatholders',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'holder_name', 'hold_amount', 'hold_ratio']
    )
    if (rows.length === 0) return { success: false, message: '前十大流通股东无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const reportDate = toYmd(row.end_date || row.ann_date)
        if (!reportDate) return null
        return {
          updateOne: {
            filter: { symbol, report_date: reportDate, holder_name: String(row.holder_name || '') },
            update: {
              $set: {
                symbol,
                report_date: reportDate,
                holder_name: String(row.holder_name || ''),
                hold_amount: toNum(row.hold_amount),
                hold_ratio: toNum(row.hold_ratio),
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
      await db.collection('institution_holding').bulkWrite(ops, { ordered: false }).catch(() => { })
    }
    return { success: true, message: `${symbol} 前十大流通股东已更新 ${ops.length} 条`, count: ops.length }
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
