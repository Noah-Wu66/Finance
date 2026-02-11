import { getDb } from '@/lib/db'

const FRESHNESS_MS = 30 * 60 * 1000

async function safeFetch(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function getSecId(code: string): string {
  if (code.startsWith('6') || code.startsWith('9')) return `1.${code}`
  return `0.${code}`
}

function getMarketStr(code: string): string {
  if (code.startsWith('6') || code.startsWith('9')) return 'sh'
  return 'sz'
}

async function isFresh(collection: string, query: Record<string, unknown>): Promise<boolean> {
  const db = await getDb()
  const doc = await db.collection(collection).findOne(query, { sort: { updated_at: -1 }, projection: { updated_at: 1 } })
  if (!doc?.updated_at) return false
  return Date.now() - new Date(doc.updated_at as string | Date).getTime() < FRESHNESS_MS
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ============================================================
// 1. 交易日历 - 新浪财经
// ============================================================
export async function fetchTradingCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('trading_calendar', { market: 'SSE' })) {
    return { success: true, message: '交易日历缓存有效', count: 0 }
  }

  try {
    const url = 'https://finance.sina.com.cn/realstock/company/klc_td_sh.txt'
    const res = await safeFetch(url, 20000)
    if (!res.ok) return { success: false, message: `新浪交易日历 HTTP ${res.status}`, count: 0 }

    const text = await res.text()
    const dateMatches = text.match(/\d{4}-\d{2}-\d{2}/g)
    if (!dateMatches || dateMatches.length === 0) {
      return { success: false, message: '未解析到交易日期', count: 0 }
    }

    const tradeDates = new Set(dateMatches.map((d) => d.replace(/-/g, '')))
    const db = await getDb()
    const now = new Date()
    const today = todayYmd()

    const ops = []
    for (const date of tradeDates) {
      if (date < daysAgoYmd(30) || date > today) continue
      ops.push({
        updateOne: {
          filter: { market: 'SSE', date },
          update: {
            $set: { market: 'SSE', date, is_trading_day: 1, updated_at: now },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      })
    }

    if (ops.length > 0) {
      await db.collection('trading_calendar').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `交易日历已更新 ${ops.length} 天`, count: ops.length }
  } catch (err) {
    return { success: false, message: `交易日历拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 2. 指数历史K线 - 东方财富
// ============================================================
export async function fetchIndexDaily(indexCode = '000300', days = 120): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('index_daily', { index_code: indexCode })) {
    return { success: true, message: `指数 ${indexCode} 缓存有效`, count: 0 }
  }

  try {
    const secId = indexCode.startsWith('399') ? `0.${indexCode}` : `1.${indexCode}`
    const beg = daysAgoYmd(days)
    const end = todayYmd()
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&beg=${beg}&end=${end}&ut=7eea3edcaed734bea9cbfc24409ed989`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `指数K线 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const klines = json?.data?.klines as string[] | undefined
    if (!klines || klines.length === 0) return { success: false, message: '指数K线无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = klines.map((line) => {
      const p = line.split(',')
      if (p.length < 9) return null
      const tradeDate = p[0].replace(/-/g, '')
      return {
        updateOne: {
          filter: { index_code: indexCode, trade_date: tradeDate },
          update: {
            $set: {
              index_code: indexCode, trade_date: tradeDate,
              open: toNum(p[1]), close: toNum(p[2]), high: toNum(p[3]), low: toNum(p[4]),
              volume: toNum(p[5]), pct_chg: toNum(p[8]),
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('index_daily').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `指数 ${indexCode} 已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `指数K线拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 3. 个股资金流 - 东方财富
// ============================================================
export async function fetchFundFlow(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_fund_flow', { symbol: code })) {
    return { success: true, message: `${code} 资金流缓存有效`, count: 0 }
  }

  try {
    const market = getMarketStr(code)
    const secId = getSecId(code)
    const url = `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secId}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&klt=101&lmt=30`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `资金流 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const klines = json?.data?.klines as string[] | undefined
    if (!klines || klines.length === 0) return { success: false, message: '资金流无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = klines.map((line) => {
      const p = line.split(',')
      if (p.length < 5) return null
      const tradeDate = p[0].replace(/-/g, '')
      return {
        updateOne: {
          filter: { symbol: code, trade_date: tradeDate },
          update: {
            $set: {
              symbol: code, trade_date: tradeDate,
              main_inflow: toNum(p[1]),
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_fund_flow').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${code} 资金流已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `资金流拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 4. 板块资金流（行业聚合） - 东方财富
// ============================================================
export async function fetchIndustryAggregation(industry: string): Promise<{ success: boolean; message: string; count: number }> {
  if (!industry) return { success: false, message: '行业名为空', count: 0 }
  if (await isFresh('industry_aggregation', { industry_name: industry })) {
    return { success: true, message: `行业 ${industry} 缓存有效`, count: 0 }
  }

  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f12,f14,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `板块资金流 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const items = json?.data?.diff as Array<Record<string, unknown>> | undefined
    if (!items || items.length === 0) return { success: false, message: '板块资金流无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const tradeDate = todayYmd()
    let matched = false

    const ops = items.map((item) => {
      const name = String(item.f14 || '')
      if (!name) return null
      if (name === industry) matched = true
      return {
        updateOne: {
          filter: { industry_name: name, trade_date: tradeDate },
          update: {
            $set: {
              industry_name: name, trade_date: tradeDate,
              industry_main_inflow: toNum(item.f62),
              industry_sentiment: toNum(item.f184),
              industry_heat: toNum(item.f66),
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('industry_aggregation').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `板块资金流已更新 ${ops.length} 条${matched ? '' : `（未匹配到 ${industry}）`}`, count: ops.length }
  } catch (err) {
    return { success: false, message: `板块资金流拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 5. 业绩预告 - 东方财富
// ============================================================
export async function fetchEarningsExpectation(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('earnings_expectation', { symbol: code })) {
    return { success: true, message: `${code} 业绩预期缓存有效`, count: 0 }
  }

  try {
    const filter = `(SECURITY_CODE="${code}")`
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE&sortTypes=-1&pageSize=10&pageNumber=1&reportName=RPT_PUBLIC_OP_NEWPREDICT&columns=ALL&filter=${encodeURIComponent(filter)}`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `业绩预告 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const rows = json?.result?.data as Array<Record<string, unknown>> | undefined
    if (!rows || rows.length === 0) return { success: false, message: '业绩预告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => {
      const announceDate = String(row.NOTICE_DATE || '').slice(0, 10).replace(/-/g, '') || 'latest'
      const forecastType = String(row.PREDICT_FINANCE_CODE || row.PREDICT_TYPE || 'forecast')
      return {
        updateOne: {
          filter: { symbol: code, announce_date: announceDate, source_type: forecastType },
          update: {
            $set: {
              symbol: code, announce_date: announceDate, source_type: forecastType,
              forecast_type: String(row.PREDICT_TYPE || ''),
              profit_change_pct: row.ADD_AMP ? toNum(row.ADD_AMP) : undefined,
              forecast_value: row.PREDICT_FINANCE ? String(row.PREDICT_FINANCE) : undefined,
              change_reason: row.CHANGE_REASON_EXPLAIN ? String(row.CHANGE_REASON_EXPLAIN) : undefined,
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
    return { success: true, message: `${code} 业绩预告已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `业绩预告拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 6. 增强财务 - 东方财富
// ============================================================
export async function fetchFinancialEnhanced(code: string): Promise<{ success: boolean; message: string }> {
  if (await isFresh('financial_enhanced', { symbol: code })) {
    return { success: true, message: `${code} 增强财务缓存有效` }
  }

  try {
    const filter = `(SECURITY_CODE="${code}")`
    const columns = 'SECURITY_CODE,REPORT_DATE,GROSSPROFIT_MARGIN,ASSET_LIAB_RATIO,OPERATE_INCOME_YOY,NETPROFIT_YOY,OPERATE_CASHFLOW_NETAMOUNT,NETPROFIT'
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=1&pageNumber=1&reportName=RPT_DMSK_FN_ZCFZ&columns=${columns}&filter=${encodeURIComponent(filter)}`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `增强财务 HTTP ${res.status}` }

    const json = await res.json()
    const row = json?.result?.data?.[0]
    if (!row) return { success: false, message: '增强财务无数据' }

    const reportPeriod = String(row.REPORT_DATE || '').slice(0, 10).replace(/-/g, '') || 'latest'
    const netProfit = toNum(row.NETPROFIT)
    const ocf = toNum(row.OPERATE_CASHFLOW_NETAMOUNT)

    const db = await getDb()
    const now = new Date()
    await db.collection('financial_enhanced').updateOne(
      { symbol: code, report_period: reportPeriod },
      {
        $set: {
          symbol: code, report_period: reportPeriod,
          profit_yoy: row.NETPROFIT_YOY != null ? toNum(row.NETPROFIT_YOY) : undefined,
          gross_margin: row.GROSSPROFIT_MARGIN != null ? toNum(row.GROSSPROFIT_MARGIN) : undefined,
          debt_to_asset: row.ASSET_LIAB_RATIO != null ? toNum(row.ASSET_LIAB_RATIO) : undefined,
          operating_cashflow: ocf || undefined,
          ocf_to_profit: netProfit !== 0 ? toNum((ocf / netProfit).toFixed(4)) : undefined,
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )
    return { success: true, message: `${code} 增强财务已更新` }
  } catch (err) {
    return { success: false, message: `增强财务拉取失败: ${err instanceof Error ? err.message : '未知'}` }
  }
}

// ============================================================
// 7. 公告事件 - 东方财富
// ============================================================
export async function fetchStockEvents(code: string): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_events', { symbol: code })) {
    return { success: true, message: `${code} 公告缓存有效`, count: 0 }
  }

  try {
    const filter = `(SECURITY_CODE="${code}")`
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE&sortTypes=-1&pageSize=30&pageNumber=1&reportName=RPT_CUSTOM_NOTICE&columns=SECURITY_CODE,NOTICE_DATE,NOTICE_TITLE,NOTICE_TYPE&filter=${encodeURIComponent(filter)}`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `公告 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const rows = json?.result?.data as Array<Record<string, unknown>> | undefined
    if (!rows || rows.length === 0) return { success: false, message: '公告无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows.map((row) => {
      const title = String(row.NOTICE_TITLE || '').trim()
      const eventDate = String(row.NOTICE_DATE || '').slice(0, 10).replace(/-/g, '') || todayYmd()
      if (!title) return null
      return {
        updateOne: {
          filter: { symbol: code, event_date: eventDate, title },
          update: {
            $set: {
              symbol: code, event_type: String(row.NOTICE_TYPE || 'announcement'),
              event_date: eventDate, title, impact: 'unknown',
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_events').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${code} 公告已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `公告拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 8. 宏观日历 - 东方财富
// ============================================================
export async function fetchMacroCalendar(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('macro_calendar', {})) {
    return { success: true, message: '宏观日历缓存有效', count: 0 }
  }

  const db = await getDb()
  const now = new Date()
  let total = 0

  const macroApis: Array<{ indicator: string; url: string; valuePath: (row: Record<string, unknown>) => number | undefined; datePath: (row: Record<string, unknown>) => string }> = [
    {
      indicator: 'CPI_YoY',
      url: 'https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=6&pageNumber=1&reportName=RPT_ECONOMY_CPI&columns=REPORT_DATE,NATIONAL_SAME',
      valuePath: (row) => row.NATIONAL_SAME != null ? toNum(row.NATIONAL_SAME) : undefined,
      datePath: (row) => String(row.REPORT_DATE || '').slice(0, 10)
    },
    {
      indicator: 'PMI',
      url: 'https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=REPORT_DATE&sortTypes=-1&pageSize=6&pageNumber=1&reportName=RPT_ECONOMY_PMI&columns=REPORT_DATE,MAKE_INDEX',
      valuePath: (row) => row.MAKE_INDEX != null ? toNum(row.MAKE_INDEX) : undefined,
      datePath: (row) => String(row.REPORT_DATE || '').slice(0, 10)
    }
  ]

  for (const api of macroApis) {
    try {
      const res = await safeFetch(api.url)
      if (!res.ok) continue
      const json = await res.json()
      const rows = json?.result?.data as Array<Record<string, unknown>> | undefined
      if (!rows) continue

      const ops = rows.map((row) => {
        const date = api.datePath(row)
        const value = api.valuePath(row)
        if (!date) return null
        return {
          updateOne: {
            filter: { date, indicator: api.indicator },
            update: {
              $set: { date, indicator: api.indicator, value, source: 'eastmoney', updated_at: now },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        }
      }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

      if (ops.length > 0) {
        await db.collection('macro_calendar').bulkWrite(ops, { ordered: false }).catch(() => {})
        total += ops.length
      }
    } catch {
      continue
    }
  }

  return { success: total > 0, message: `宏观日历已更新 ${total} 条`, count: total }
}

// ============================================================
// 9. 分时盘口 - 东方财富
// ============================================================
export async function fetchIntraday(code: string, period = '1'): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('stock_intraday', { symbol: code, period })) {
    return { success: true, message: `${code} 分时缓存有效`, count: 0 }
  }

  try {
    const secId = getSecId(code)
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=0&end=20500101&lmt=120&ut=7eea3edcaed734bea9cbfc24409ed989`

    const res = await safeFetch(url)
    if (!res.ok) return { success: false, message: `分时 HTTP ${res.status}`, count: 0 }

    const json = await res.json()
    const klines = json?.data?.klines as string[] | undefined
    if (!klines || klines.length === 0) return { success: false, message: '分时无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = klines.map((line) => {
      const p = line.split(',')
      if (p.length < 7) return null
      const datetime = p[0]
      return {
        updateOne: {
          filter: { symbol: code, datetime, period },
          update: {
            $set: {
              symbol: code, datetime, period,
              open: toNum(p[1]), close: toNum(p[2]), high: toNum(p[3]), low: toNum(p[4]),
              volume: toNum(p[5]), amount: toNum(p[6]),
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter(Boolean) as Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>

    if (ops.length > 0) {
      await db.collection('stock_intraday').bulkWrite(ops, { ordered: false }).catch(() => {})
    }
    return { success: true, message: `${code} 分时已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `分时拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ============================================================
// 一键拉取所有增强数据
// ============================================================
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
    fundFlowResult,
    industryResult,
    earningsResult,
    financialResult,
    eventsResult,
    macroResult,
    intradayResult
  ] = await Promise.all([
    fetchFundFlow(symbol),
    fetchIndustryAggregation(industry),
    fetchEarningsExpectation(symbol),
    fetchFinancialEnhanced(symbol),
    fetchStockEvents(symbol),
    fetchMacroCalendar(),
    fetchIntraday(symbol, '1')
  ])

  const results: Record<string, { success: boolean; message: string }> = {
    trading_calendar: calendarResult,
    fund_flow: fundFlowResult,
    industry_aggregation: industryResult,
    earnings_expectation: earningsResult,
    financial_enhanced: financialResult,
    stock_events: eventsResult,
    macro_calendar: macroResult,
    intraday: intradayResult
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
