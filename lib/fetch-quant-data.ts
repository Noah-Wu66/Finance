import { createHash } from 'node:crypto'

import { analyzeWithAI, isAIEnabled } from '@/lib/ai-client'
import { getDb } from '@/lib/db'
import { hasMairuiLicence, tusharePost, toTsCode, todayYmd, daysAgoYmd } from '@/lib/mairui-data'
import { TUSHARE_CASHFLOW_FIELDS, TUSHARE_FINA_INDICATOR_FIELDS } from '@/lib/tushare-field-sets'
import { callTushare11000 } from '@/lib/tushare-11000-call'
import { getTushare11000Endpoints, normalizeTushareApiName } from '@/lib/tushare-11000'

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

function toDateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  const text = String(value || '').trim()
  if (!text) return null

  const normalized = toYmd(text)
  if (normalized.length === 8) {
    const parsed = new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00+08:00`)
    if (Number.isFinite(parsed.getTime())) return parsed
  }

  const parsed = new Date(text)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

function buildNewsDedupId(input: {
  symbol: string
  title: string
  url: string
  publishTime: string
}): string {
  const payload = `${input.symbol}|${input.title}|${input.url}|${input.publishTime}`
  return createHash('sha1').update(payload).digest('hex')
}

interface DynamicTushareExecutionItem {
  api_name: string
  doc_id?: number
  reason: string
  count: number
  status: 'ok' | 'error'
  message: string
}

export interface DynamicTusharePlanResult {
  selected_count: number
  total_records: number
  selected_apis: string[]
  executed: DynamicTushareExecutionItem[]
}

function normalizeFields(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => /^[a-z][a-z0-9_]*$/.test(item))
}

function normalizePlanParams(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return { ...(input as Record<string, unknown>) }
}

function summarizeDynamicPlanMessage(plan: DynamicTusharePlanResult): string {
  if (plan.selected_count === 0) return '模型未选择额外 Tushare 接口'
  const okCount = plan.executed.filter((item) => item.status === 'ok').length
  const failedCount = plan.executed.length - okCount
  return `模型选择 ${plan.selected_count} 个接口，成功 ${okCount} 个，失败 ${failedCount} 个，共返回 ${plan.total_records} 条记录`
}

async function fetchModelDirectedTushareData(input: {
  symbol: string
  market: string
  industry: string
}): Promise<DynamicTusharePlanResult> {
  const aiEnabled = await isAIEnabled()
  if (!aiEnabled) {
    return {
      selected_count: 0,
      total_records: 0,
      selected_apis: [],
      executed: []
    }
  }

  const endpoints = await getTushare11000Endpoints()
  const fixedApis = new Set([
    'trade_cal',
    'etf_daily',
    'moneyflow_hsgt',
    'moneyflow',
    'fina_indicator',
    'fina_forecast',
    'adj_factor',
    'dividend',
    'margin_detail',
    'toplist',
    'top10_floatholders'
  ])

  const candidates = endpoints.filter((item) => !fixedApis.has(item.api_name))
  if (candidates.length === 0) {
    return {
      selected_count: 0,
      total_records: 0,
      selected_apis: [],
      executed: []
    }
  }

  const catalogText = candidates
    .map((item) => {
      const docId = item.doc_id == null ? 'NA' : String(item.doc_id)
      const paramsText = item.params.length > 0 ? item.params.join(',') : '-'
      return `doc_id=${docId} api_name=${item.api_name} params=${paramsText}`
    })
    .join('\n')

  const tsCode = toTsCode(input.symbol)
  const prompt = `你要为单只股票选择最有价值的 Tushare 接口。\n\n股票代码: ${input.symbol}\nTushare代码: ${tsCode}\n市场: ${input.market}\n行业: ${input.industry || '未知'}\n\n候选接口清单:\n${catalogText}\n\n请只从上面清单中选择最多6个接口，返回严格JSON（不要输出任何其他文字）：\n{\n  "plan": [\n    {\n      "api_name": "接口名",\n      "doc_id": 文档编号或null,\n      "reason": "选择原因（20字内）",\n      "params": {"参数名":"参数值"},\n      "fields": ["字段1","字段2"]\n    }\n  ]\n}\n\n要求:\n1) 必须优先选对个股短中期走势有帮助的接口。\n2) 只允许使用清单里的 api_name/doc_id。\n3) 如果接口需要 ts_code，必须使用 ${tsCode}。\n4) 如果需要日期参数，优先最近120天。\n5) reason 必须简短、直接。`

  let rawPlanRows: Array<Record<string, unknown>> = []
  try {
    const aiResult = await analyzeWithAI({
      systemPrompt: '你是量化数据接口规划器，只输出可解析JSON。',
      messages: [{ role: 'user', content: prompt }]
    })
    const parsed = parseJsonObject(aiResult.content)
    rawPlanRows = Array.isArray(parsed?.plan) ? (parsed?.plan as Array<Record<string, unknown>>) : []
  } catch {
    rawPlanRows = []
  }

  const selected: Array<{
    api_name: string
    doc_id?: number
    reason: string
    params: Record<string, unknown>
    fields: string[]
  }> = []
  const seen = new Set<string>()

  for (const row of rawPlanRows) {
    if (selected.length >= 6) break

    const apiName = normalizeTushareApiName(row.api_name)
    if (!apiName) continue

    const docIdRaw = Number(row.doc_id)
    const docId = Number.isFinite(docIdRaw) ? Math.trunc(docIdRaw) : undefined

    const matched = docId === undefined
      ? candidates.find((item) => item.api_name === apiName)
      : candidates.find((item) => item.api_name === apiName && item.doc_id === docId)

    if (!matched) continue

    const key = `${matched.api_name}#${matched.doc_id ?? 'na'}`
    if (seen.has(key)) continue
    seen.add(key)

    const params = normalizePlanParams(row.params)
    if (matched.params.includes('ts_code')) params.ts_code = tsCode
    if (matched.params.includes('start_date') && !hasValue(params.start_date)) params.start_date = daysAgoYmd(120)
    if (matched.params.includes('end_date') && !hasValue(params.end_date)) params.end_date = todayYmd()
    if (matched.params.includes('trade_date') && !hasValue(params.trade_date)) params.trade_date = todayYmd()

    selected.push({
      api_name: matched.api_name,
      doc_id: matched.doc_id,
      reason: String(row.reason || '').trim() || '模型推荐',
      params,
      fields: normalizeFields(row.fields)
    })
  }

  const executed: DynamicTushareExecutionItem[] = []
  let totalRecords = 0

  for (const item of selected) {
    try {
      const callResult = await callTushare11000({
        apiName: item.api_name,
        docId: item.doc_id,
        params: item.params,
        fields: item.fields.length > 0 ? item.fields : undefined,
        autoFillParams: true
      })
      const count = callResult.records.length
      totalRecords += count
      executed.push({
        api_name: item.api_name,
        doc_id: item.doc_id,
        reason: item.reason,
        count,
        status: 'ok',
        message: `返回 ${count} 条`
      })
    } catch (error) {
      executed.push({
        api_name: item.api_name,
        doc_id: item.doc_id,
        reason: item.reason,
        count: 0,
        status: 'error',
        message: error instanceof Error ? error.message : '调用失败'
      })
    }
  }

  return {
    selected_count: selected.length,
    total_records: totalRecords,
    selected_apis: selected.map((item) => item.api_name),
    executed
  }
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

// ─── 指数基准（ETF 代理）────────────────────────────────────────────────────────

export async function fetchIndexBenchmarks(): Promise<{ success: boolean; message: string; count: number }> {
  if (await isFresh('index_daily', { source: 'tushare_etf_proxy' })) {
    return { success: true, message: '指数基准缓存有效', count: 0 }
  }
  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  const benchmarkProxies = [
    { index_code: '000300', index_name: '沪深300', proxy_name: '沪深300ETF', ts_code: '510300.SH' },
    { index_code: '000016', index_name: '上证50', proxy_name: '上证50ETF', ts_code: '510050.SH' },
    { index_code: '000905', index_name: '中证500', proxy_name: '中证500ETF', ts_code: '510500.SH' },
    { index_code: '399006', index_name: '创业板指', proxy_name: '创业板ETF', ts_code: '159915.SZ' }
  ]

  try {
    const endDate = todayYmd()
    const startDate = daysAgoYmd(180)
    const responseList = await Promise.all(
      benchmarkProxies.map(async (proxy) => {
        const rows = await tusharePost(
          'etf_daily',
          {
            ts_code: proxy.ts_code,
            start_date: startDate,
            end_date: endDate
          },
          ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']
        )
        return { proxy, rows }
      })
    )

    const db = await getDb()
    const now = new Date()
    const ops: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = []

    for (const item of responseList) {
      for (const row of item.rows) {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) continue
        ops.push({
          updateOne: {
            filter: { index_code: item.proxy.index_code, trade_date: tradeDate },
            update: {
              $set: {
                index_code: item.proxy.index_code,
                index_name: item.proxy.index_name,
                proxy_name: item.proxy.proxy_name,
                proxy_ts_code: item.proxy.ts_code,
                trade_date: tradeDate,
                open: toNum(row.open),
                high: toNum(row.high),
                low: toNum(row.low),
                close: toNum(row.close),
                pre_close: toNum(row.pre_close),
                change: toNum(row.change),
                pct_chg: toNum(row.pct_chg),
                volume: toNum(row.vol),
                amount: toNum(row.amount),
                source: 'tushare_etf_proxy',
                updated_at: now
              },
              $setOnInsert: { created_at: now }
            },
            upsert: true
          }
        })
      }
    }

    if (ops.length > 0) {
      await db.collection('index_daily').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `指数基准已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `指数基准拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
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

// ─── 复权因子（adj_factor）──────────────────────────────────────────────────────

export async function fetchAdjustFactors(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }
  if (await isFresh('stock_adjust_factors', { symbol })) {
    return { success: true, message: `${symbol} 复权因子缓存有效`, count: 0 }
  }

  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'adj_factor',
      { ts_code: tsCode, start_date: daysAgoYmd(365), end_date: todayYmd() },
      ['ts_code', 'trade_date', 'adj_factor']
    )
    if (rows.length === 0) return { success: false, message: '复权因子无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const tradeDate = toYmd(row.trade_date)
        if (!tradeDate) return null
        return {
          updateOne: {
            filter: { symbol, ex_dividend_date: tradeDate },
            update: {
              $set: {
                symbol,
                ex_dividend_date: tradeDate,
                adj_factor: toNum(row.adj_factor),
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
      await db.collection('stock_adjust_factors').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `${symbol} 复权因子已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `复权因子拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 公司行为（分红送转）────────────────────────────────────────────────────────

export async function fetchCorporateActions(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }
  if (await isFresh('stock_corporate_actions', { symbol })) {
    return { success: true, message: `${symbol} 公司行为缓存有效`, count: 0 }
  }

  const tok = ensureTushare()
  if (!tok.ok) return { success: false, message: tok.message, count: 0 }

  try {
    const tsCode = toTsCode(symbol)
    const rows = await tusharePost(
      'dividend',
      { ts_code: tsCode },
      ['ts_code', 'ann_date', 'end_date', 'record_date', 'ex_date', 'pay_date', 'cash_div', 'stk_div', 'stk_bo_rate', 'stk_co_rate', 'base_share', 'div_proc']
    )
    if (rows.length === 0) return { success: false, message: '公司行为无数据', count: 0 }

    const db = await getDb()
    const now = new Date()
    const ops = rows
      .map((row) => {
        const exDate = toYmd(row.ex_date || row.record_date || row.pay_date || row.ann_date || row.end_date)
        if (!exDate) return null

        return {
          updateOne: {
            filter: { symbol, ex_dividend_date: exDate, action_type: 'dividend' },
            update: {
              $set: {
                symbol,
                action_type: 'dividend',
                ex_dividend_date: exDate,
                cash_dividend_ps: toNum(row.cash_div),
                bonus_share_ps: toNum(row.stk_div),
                reserve_to_stock_ps: toNum(row.stk_bo_rate),
                rights_issue_price: undefined,
                regist_date: toYmd(row.record_date) || undefined,
                pay_date: toYmd(row.pay_date) || undefined,
                announce_date: toYmd(row.ann_date) || undefined,
                report_period: toYmd(row.end_date) || undefined,
                base_share: toNum(row.base_share),
                progress: firstString(row, ['div_proc']) || undefined,
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
      await db.collection('stock_corporate_actions').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `${symbol} 公司行为已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `公司行为拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 新闻情绪（Gemini + Google Search Grounding）─────────────────────────────

export async function fetchNewsSentiment(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }

  if (await isFresh('news_sentiment', { symbol })) {
    return { success: true, message: `${symbol} 新闻情绪缓存有效`, count: 0 }
  }

  const aiEnabled = await isAIEnabled()
  if (!aiEnabled) {
    return { success: false, message: '未配置 AI Key，无法生成新闻情绪', count: 0 }
  }

  const today = todayYmd()
  const prompt = `请联网检索 ${symbol} 最近7天的财经新闻、公告、研报、行业动态。
你必须返回严格JSON，不要包含任何其他文本，格式如下：
{
  "items": [
    {
      "title": "新闻标题",
      "snippet": "一句话摘要",
      "publish_time": "YYYYMMDD",
      "url": "https://...",
      "source": "媒体或机构",
      "sentiment_score": -1到1之间的小数,
      "relevance_score": 0到1之间的小数
    }
  ]
}
要求：
1) 最多返回20条，尽量覆盖不重复来源。
2) 只返回与 ${symbol} 直接相关的内容。
3) publish_time 缺失时用 ${today}。`

  try {
    const aiResult = await analyzeWithAI({
      systemPrompt: '你是严谨的金融新闻分析助手。输出必须是可解析JSON。',
      messages: [{ role: 'user', content: prompt }]
    })

    const parsed = parseJsonObject(aiResult.content)
    const rawItems = Array.isArray(parsed?.items) ? (parsed?.items as Array<Record<string, unknown>>) : []

    const fallbackItems = rawItems.length === 0
      ? aiResult.sources.map((source) => ({
          title: source.title,
          snippet: '',
          publish_time: today,
          url: source.uri,
          source: 'Google Search',
          sentiment_score: 0,
          relevance_score: 0.5
        }))
      : rawItems

    const normalizedItems = fallbackItems
      .map((item) => {
        const row = item as Record<string, unknown>
        const title = String(row.title || '').trim()
        const snippet = String(row.snippet || '').trim()
        const publishTime = toYmd(row.publish_time || row.date) || today
        const url = String(row.url || row.link || '').trim()
        const source = String(row.source || 'unknown').trim() || 'unknown'
        const sentimentScore = clamp(toNum(row.sentiment_score), -1, 1)
        const relevanceScore = clamp(toNum(row.relevance_score), 0, 1)
        if (!title && !url) return null
        const dedupId = buildNewsDedupId({
          symbol,
          title: title || url,
          url,
          publishTime
        })
        return {
          symbol,
          title: title || url,
          summary: snippet,
          publish_time: publishTime,
          url,
          source,
          sentiment_score: sentimentScore,
          relevance_score: relevanceScore,
          dedup_id: dedupId,
          search_queries: aiResult.search_queries,
          grounding_sources: aiResult.sources,
          updated_at: new Date(),
          created_at: new Date()
        }
      })
      .filter((item): item is {
        symbol: string
        title: string
        summary: string
        publish_time: string
        url: string
        source: string
        sentiment_score: number
        relevance_score: number
        dedup_id: string
        search_queries: string[]
        grounding_sources: Array<{ title: string; uri: string }>
        updated_at: Date
        created_at: Date
      } => Boolean(item))
      .slice(0, 20)

    const db = await getDb()
    const ops = normalizedItems.map((item) => ({
      updateOne: {
        filter: { dedup_id: item.dedup_id },
        update: {
          $set: {
            symbol: item.symbol,
            title: item.title,
            summary: item.summary,
            publish_time: item.publish_time,
            url: item.url,
            source: item.source,
            sentiment_score: item.sentiment_score,
            relevance_score: item.relevance_score,
            dedup_id: item.dedup_id,
            search_queries: item.search_queries,
            grounding_sources: item.grounding_sources,
            updated_at: item.updated_at
          },
          $setOnInsert: {
            created_at: item.created_at
          }
        },
        upsert: true
      }
    }))

    if (ops.length > 0) {
      await db.collection('news_sentiment').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `${symbol} 新闻情绪已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `新闻情绪拉取失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
  }
}

// ─── 数据质量快照 ───────────────────────────────────────────────────────────────

export async function refreshDataQualitySnapshot(code: string): Promise<{ success: boolean; message: string; count: number }> {
  const symbol = normalizeCode(code)
  if (!symbol) return { success: false, message: '股票代码为空', count: 0 }

  try {
    const db = await getDb()
    const now = new Date()
    const asOf = todayYmd()

    const checks = [
      { dataset: 'trading_calendar', collection: 'trading_calendar', query: { market: 'SSE' }, symbolForRecord: '', staleSec: 7 * 24 * 3600 },
      { dataset: 'index_daily', collection: 'index_daily', query: {}, symbolForRecord: '', staleSec: 7 * 24 * 3600 },
      { dataset: 'stock_fund_flow', collection: 'stock_fund_flow', query: { symbol }, symbolForRecord: symbol, staleSec: 7 * 24 * 3600 },
      { dataset: 'financial_enhanced', collection: 'financial_enhanced', query: { symbol }, symbolForRecord: symbol, staleSec: 180 * 24 * 3600 },
      { dataset: 'news_sentiment', collection: 'news_sentiment', query: { symbol }, symbolForRecord: symbol, staleSec: 7 * 24 * 3600 },
      { dataset: 'stock_adjust_factors', collection: 'stock_adjust_factors', query: { symbol }, symbolForRecord: symbol, staleSec: 180 * 24 * 3600 },
      { dataset: 'stock_corporate_actions', collection: 'stock_corporate_actions', query: { symbol }, symbolForRecord: symbol, staleSec: 365 * 24 * 3600 },
      { dataset: 'industry_aggregation', collection: 'industry_aggregation', query: {}, symbolForRecord: symbol, staleSec: 7 * 24 * 3600 },
      { dataset: 'earnings_expectation', collection: 'earnings_expectation', query: { symbol }, symbolForRecord: symbol, staleSec: 180 * 24 * 3600 },
      { dataset: 'northbound_flow', collection: 'northbound_flow', query: {}, symbolForRecord: '', staleSec: 7 * 24 * 3600 },
      { dataset: 'margin_trading', collection: 'margin_trading', query: { symbol }, symbolForRecord: symbol, staleSec: 7 * 24 * 3600 },
      { dataset: 'dragon_tiger', collection: 'dragon_tiger', query: { symbol }, symbolForRecord: symbol, staleSec: 14 * 24 * 3600 },
      { dataset: 'institution_holding', collection: 'institution_holding', query: { symbol }, symbolForRecord: symbol, staleSec: 180 * 24 * 3600 }
    ]

    const ops: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = []

    for (const check of checks) {
      const latest = await db.collection(check.collection)
        .find(check.query)
        .sort({ updated_at: -1, created_at: -1, trade_date: -1, report_period: -1, date: -1 })
        .limit(1)
        .next()

      const latestAt =
        toDateValue(latest?.updated_at) ||
        toDateValue(latest?.created_at) ||
        toDateValue(latest?.trade_date) ||
        toDateValue(latest?.date) ||
        toDateValue(latest?.report_period) ||
        toDateValue(latest?.announce_date)

      const latencySec = latestAt
        ? Math.max(0, Math.floor((now.getTime() - latestAt.getTime()) / 1000))
        : -1

      const qualityFlag = !latest
        ? 'EMPTY'
        : latencySec > check.staleSec
          ? 'STALE'
          : 'OK'

      ops.push({
        updateOne: {
          filter: {
            dataset: check.dataset,
            symbol: check.symbolForRecord,
            as_of: asOf
          },
          update: {
            $set: {
              dataset: check.dataset,
              symbol: check.symbolForRecord,
              as_of: asOf,
              latency_sec: latencySec,
              source: latest?.source ? String(latest.source) : 'system_check',
              quality_flag: qualityFlag,
              updated_at: now
            },
            $setOnInsert: {
              created_at: now
            }
          },
          upsert: true
        }
      })
    }

    if (ops.length > 0) {
      await db.collection('data_quality').bulkWrite(ops, { ordered: false }).catch(() => { })
    }

    return { success: true, message: `数据质量快照已更新 ${ops.length} 条`, count: ops.length }
  } catch (err) {
    return { success: false, message: `数据质量快照更新失败: ${err instanceof Error ? err.message : '未知'}`, count: 0 }
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
}): Promise<{
  success: boolean
  message: string
  results: Record<string, { success: boolean; message: string }>
  dynamic_plan: DynamicTusharePlanResult
}> {
  const { symbol, industry, market } = params

  const calendarResult = await fetchTradingCalendar()

  const [
    indexResult,
    northboundResult,
    fundFlowResult,
    industryResult,
    earningsResult,
    financialResult,
    adjustFactorResult,
    corporateActionResult,
    newsSentimentResult,
    marginResult,
    dragonTigerResult,
    institutionResult
  ] = await Promise.all([
    fetchIndexBenchmarks(),
    fetchNorthboundFlow(),
    fetchFundFlow(symbol),
    fetchIndustryAggregation(industry),
    fetchEarningsExpectation(symbol),
    fetchFinancialEnhanced(symbol),
    fetchAdjustFactors(symbol),
    fetchCorporateActions(symbol),
    fetchNewsSentiment(symbol),
    fetchMarginTrading(symbol),
    fetchDragonTiger(symbol),
    fetchInstitutionHolding(symbol)
  ])

  const dataQualityResult = await refreshDataQualitySnapshot(symbol)
  const dynamicPlanResult = await fetchModelDirectedTushareData({
    symbol,
    market,
    industry
  })

  const results: Record<string, { success: boolean; message: string }> = {
    trading_calendar: calendarResult,
    index_daily: indexResult,
    northbound_flow: northboundResult,
    fund_flow: fundFlowResult,
    industry_aggregation: industryResult,
    earnings_expectation: earningsResult,
    financial_enhanced: financialResult,
    stock_adjust_factors: adjustFactorResult,
    stock_corporate_actions: corporateActionResult,
    news_sentiment: newsSentimentResult,
    margin_trading: marginResult,
    dragon_tiger: dragonTigerResult,
    institution_holding: institutionResult,
    data_quality: dataQualityResult,
    model_directed_tushare: {
      success: dynamicPlanResult.executed.every((item) => item.status === 'ok'),
      message: summarizeDynamicPlanMessage(dynamicPlanResult)
    }
  }

  const allOk = Object.values(results).every((r) => r.success)
  const failedCount = Object.values(results).filter((r) => !r.success).length
  const msg = allOk
    ? '所有增强数据已就绪'
    : `${failedCount} 项数据拉取失败或无数据，其余已就绪`

  return {
    success: true,
    message: msg,
    results,
    dynamic_plan: dynamicPlanResult
  }
}
