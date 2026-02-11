import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

type DatasetType =
  | 'trading_calendar'
  | 'index_daily'
  | 'stock_fund_flow'
  | 'stock_events'
  | 'financial_enhanced'
  | 'news_sentiment'
  | 'stock_adjust_factors'
  | 'stock_corporate_actions'
  | 'industry_aggregation'
  | 'earnings_expectation'
  | 'macro_calendar'
  | 'data_quality'
  | 'stock_intraday'

interface ImportPayload {
  dataset?: DatasetType
  records?: Array<Record<string, unknown>>
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normalizeYmd(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return ''
  const compact = text.replace(/[^0-9]/g, '')
  if (compact.length >= 8) return compact.slice(0, 8)
  return ''
}

function normalizeImpact(value: unknown): string {
  const impact = String(value || '').trim()
  if (!impact) return 'unknown'
  return impact
}

function getQualityFields(row: Record<string, unknown>) {
  const qualityFlag = String(row.quality_flag || '').trim()
  return {
    as_of: row.as_of ? String(row.as_of) : undefined,
    latency_sec: row.latency_sec == null ? undefined : toNumber(row.latency_sec),
    source: row.source ? String(row.source) : undefined,
    quality_flag: qualityFlag || undefined
  }
}

async function ensureIndexes(dataset: DatasetType) {
  const db = await getDb()
  if (dataset === 'trading_calendar') {
    await db.collection('trading_calendar').createIndex({ market: 1, date: 1 }, { unique: true })
    return
  }
  if (dataset === 'index_daily') {
    await db.collection('index_daily').createIndex({ index_code: 1, trade_date: 1 }, { unique: true })
    return
  }
  if (dataset === 'stock_fund_flow') {
    await db.collection('stock_fund_flow').createIndex({ symbol: 1, trade_date: 1 }, { unique: true })
    return
  }
  if (dataset === 'stock_events') {
    await db.collection('stock_events').createIndex({ symbol: 1, event_date: 1, title: 1 }, { unique: true })
    return
  }
  if (dataset === 'financial_enhanced') {
    await db.collection('financial_enhanced').createIndex({ symbol: 1, report_period: 1 }, { unique: true })
    return
  }
  if (dataset === 'news_sentiment') {
    await db.collection('news_sentiment').createIndex({ dedup_id: 1 }, { unique: true })
    return
  }
  if (dataset === 'stock_adjust_factors') {
    await db.collection('stock_adjust_factors').createIndex({ symbol: 1, ex_dividend_date: 1 }, { unique: true })
    return
  }
  if (dataset === 'stock_corporate_actions') {
    await db.collection('stock_corporate_actions').createIndex({ symbol: 1, ex_dividend_date: 1, action_type: 1 }, { unique: true })
    return
  }
  if (dataset === 'industry_aggregation') {
    await db.collection('industry_aggregation').createIndex({ industry_name: 1, trade_date: 1 }, { unique: true })
    return
  }
  if (dataset === 'earnings_expectation') {
    await db.collection('earnings_expectation').createIndex({ symbol: 1, announce_date: 1, source_type: 1 }, { unique: true })
    return
  }
  if (dataset === 'macro_calendar') {
    await db.collection('macro_calendar').createIndex({ date: 1, indicator: 1 }, { unique: true })
    return
  }
  if (dataset === 'data_quality') {
    await db.collection('data_quality').createIndex({ dataset: 1, symbol: 1, as_of: 1 }, { unique: true })
    return
  }
  if (dataset === 'stock_intraday') {
    await db.collection('stock_intraday').createIndex({ symbol: 1, datetime: 1, period: 1 }, { unique: true })
  }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as ImportPayload
  const dataset = body.dataset
  const records = Array.isArray(body.records) ? body.records : []

  if (!dataset) return fail('dataset 不能为空', 400)
  if (records.length === 0) return fail('records 不能为空', 400)
  if (records.length > 5000) return fail('单次最多导入 5000 条', 400)

  await ensureIndexes(dataset)

  const db = await getDb()
  const now = new Date()

  if (dataset === 'trading_calendar') {
    const ops = records.map((row) => {
      const market = String(row.market || 'SSE').trim() || 'SSE'
      const date = normalizeYmd(row.date)
      const nextTradingDay = normalizeYmd(row.next_trading_day)
      return {
        updateOne: {
          filter: { market, date },
          update: {
            $set: {
              market,
              date,
              is_trading_day: Number(row.is_trading_day) === 1 ? 1 : 0,
              next_trading_day: nextTradingDay || undefined,
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.date)

    const result = ops.length > 0 ? await db.collection('trading_calendar').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '交易日历导入完成')
  }

  if (dataset === 'index_daily') {
    const ops = records.map((row) => {
      const indexCode = String(row.index_code || '').trim().toUpperCase()
      const tradeDate = normalizeYmd(row.trade_date)
      return {
        updateOne: {
          filter: { index_code: indexCode, trade_date: tradeDate },
          update: {
            $set: {
              index_code: indexCode,
              trade_date: tradeDate,
              open: toNumber(row.open),
              high: toNumber(row.high),
              low: toNumber(row.low),
              close: toNumber(row.close),
              volume: toNumber(row.volume),
              pct_chg: toNumber(row.pct_chg),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.index_code && op.updateOne.filter.trade_date)

    const result = ops.length > 0 ? await db.collection('index_daily').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '指数历史导入完成')
  }

  if (dataset === 'stock_fund_flow') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const tradeDate = normalizeYmd(row.trade_date)
      return {
        updateOne: {
          filter: { symbol, trade_date: tradeDate },
          update: {
            $set: {
              symbol,
              trade_date: tradeDate,
              main_inflow: toNumber(row.main_inflow),
              northbound_net: row.northbound_net == null ? undefined : toNumber(row.northbound_net),
              margin_balance: row.margin_balance == null ? undefined : toNumber(row.margin_balance),
              short_balance: row.short_balance == null ? undefined : toNumber(row.short_balance),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.trade_date)

    const result = ops.length > 0 ? await db.collection('stock_fund_flow').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '资金流导入完成')
  }

  if (dataset === 'stock_events') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const eventDate = normalizeYmd(row.event_date)
      const title = String(row.title || '').trim()
      return {
        updateOne: {
          filter: { symbol, event_date: eventDate, title },
          update: {
            $set: {
              symbol,
              event_type: String(row.event_type || 'announcement').trim() || 'announcement',
              event_date: eventDate,
              title,
              impact: normalizeImpact(row.impact),
              url: row.url ? String(row.url) : undefined,
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.event_date && op.updateOne.filter.title)

    const result = ops.length > 0 ? await db.collection('stock_events').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '公告事件导入完成')
  }

  if (dataset === 'financial_enhanced') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || row.code || '').trim().toUpperCase()
      const reportPeriodRaw = String(row.report_period || row.report_date || '').trim()
      const reportPeriod = normalizeYmd(reportPeriodRaw) || reportPeriodRaw
      return {
        updateOne: {
          filter: { symbol, report_period: reportPeriod },
          update: {
            $set: {
              symbol,
              report_period: reportPeriod,
              profit_yoy: row.profit_yoy == null ? undefined : toNumber(row.profit_yoy),
              gross_margin: row.gross_margin == null ? undefined : toNumber(row.gross_margin),
              debt_to_asset: row.debt_to_asset == null ? undefined : toNumber(row.debt_to_asset),
              operating_cashflow: row.operating_cashflow == null ? undefined : toNumber(row.operating_cashflow),
              ocf_to_profit: row.ocf_to_profit == null ? undefined : toNumber(row.ocf_to_profit),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.report_period)

    const result = ops.length > 0 ? await db.collection('financial_enhanced').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '财务增强导入完成')
  }

  if (dataset === 'news_sentiment') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const dedupId = String(row.dedup_id || '').trim()
      return {
        updateOne: {
          filter: { dedup_id: dedupId },
          update: {
            $set: {
              symbol,
              publish_time: String(row.publish_time || ''),
              sentiment_score: toNumber(row.sentiment_score),
              relevance_score: toNumber(row.relevance_score),
              dedup_id: dedupId,
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.dedup_id)

    const result = ops.length > 0 ? await db.collection('news_sentiment').bulkWrite(ops, { ordered: false }) : null
    return ok({
      dataset,
      accepted: ops.length,
      matched: result?.matchedCount || 0,
      modified: result?.modifiedCount || 0,
      upserted: result?.upsertedCount || 0
    }, '新闻情绪导入完成')
  }

  if (dataset === 'stock_adjust_factors') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || row.code || '').trim().toUpperCase()
      const exDividendDate = normalizeYmd(row.ex_dividend_date)
      return {
        updateOne: {
          filter: { symbol, ex_dividend_date: exDividendDate },
          update: {
            $set: {
              symbol,
              ex_dividend_date: exDividendDate,
              adj_factor: row.adj_factor == null ? undefined : toNumber(row.adj_factor),
              fore_adj_factor: row.fore_adj_factor == null ? undefined : toNumber(row.fore_adj_factor),
              back_adj_factor: row.back_adj_factor == null ? undefined : toNumber(row.back_adj_factor),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.ex_dividend_date)

    const result = ops.length > 0 ? await db.collection('stock_adjust_factors').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '复权因子导入完成')
  }

  if (dataset === 'stock_corporate_actions') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || row.code || '').trim().toUpperCase()
      const exDividendDate = normalizeYmd(row.ex_dividend_date || row.dividOperateDate)
      const actionType = String(row.action_type || 'dividend').trim() || 'dividend'
      return {
        updateOne: {
          filter: { symbol, ex_dividend_date: exDividendDate, action_type: actionType },
          update: {
            $set: {
              symbol,
              action_type: actionType,
              ex_dividend_date: exDividendDate,
              cash_dividend_ps: row.cash_dividend_ps == null ? undefined : toNumber(row.cash_dividend_ps),
              bonus_share_ps: row.bonus_share_ps == null ? undefined : toNumber(row.bonus_share_ps),
              reserve_to_stock_ps: row.reserve_to_stock_ps == null ? undefined : toNumber(row.reserve_to_stock_ps),
              rights_issue_price: row.rights_issue_price == null ? undefined : toNumber(row.rights_issue_price),
              regist_date: normalizeYmd(row.regist_date || row.dividRegistDate),
              pay_date: normalizeYmd(row.pay_date || row.dividPayDate),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.ex_dividend_date)

    const result = ops.length > 0 ? await db.collection('stock_corporate_actions').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '公司行为导入完成')
  }

  if (dataset === 'industry_aggregation') {
    const ops = records.map((row) => {
      const industryName = String(row.industry_name || '').trim()
      const tradeDate = normalizeYmd(row.trade_date || row.date) || 'latest'
      return {
        updateOne: {
          filter: { industry_name: industryName, trade_date: tradeDate },
          update: {
            $set: {
              industry_name: industryName,
              trade_date: tradeDate,
              industry_main_inflow: row.industry_main_inflow == null ? undefined : toNumber(row.industry_main_inflow),
              industry_sentiment: row.industry_sentiment == null ? undefined : toNumber(row.industry_sentiment),
              industry_heat: row.industry_heat == null ? undefined : toNumber(row.industry_heat),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.industry_name)

    const result = ops.length > 0 ? await db.collection('industry_aggregation').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '行业聚合导入完成')
  }

  if (dataset === 'earnings_expectation') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const announceDate = normalizeYmd(row.announce_date || row.date) || 'latest'
      const sourceType = String(row.source_type || row.forecast_type || 'forecast').trim() || 'forecast'
      return {
        updateOne: {
          filter: { symbol, announce_date: announceDate, source_type: sourceType },
          update: {
            $set: {
              symbol,
              announce_date: announceDate,
              source_type: sourceType,
              forecast_type: row.forecast_type ? String(row.forecast_type) : undefined,
              profit_change_pct: row.profit_change_pct == null ? undefined : toNumber(row.profit_change_pct),
              forecast_value: row.forecast_value == null ? undefined : String(row.forecast_value),
              last_year_value: row.last_year_value == null ? undefined : String(row.last_year_value),
              eps: row.eps == null ? undefined : toNumber(row.eps),
              revenue: row.revenue == null ? undefined : toNumber(row.revenue),
              net_profit: row.net_profit == null ? undefined : toNumber(row.net_profit),
              change_reason: row.change_reason ? String(row.change_reason) : undefined,
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol)

    const result = ops.length > 0 ? await db.collection('earnings_expectation').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '业绩预期导入完成')
  }

  if (dataset === 'macro_calendar') {
    const ops = records.map((row) => {
      const date = String(row.date || '').trim() || 'latest'
      const indicator = String(row.indicator || '').trim()
      return {
        updateOne: {
          filter: { date, indicator },
          update: {
            $set: {
              date,
              indicator,
              value: row.value == null ? undefined : toNumber(row.value),
              previous: row.previous == null ? undefined : toNumber(row.previous),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.indicator)

    const result = ops.length > 0 ? await db.collection('macro_calendar').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '宏观日历导入完成')
  }

  if (dataset === 'data_quality') {
    const ops = records.map((row) => {
      const datasetName = String(row.dataset || '').trim()
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const asOf = String(row.as_of || '').trim()
      return {
        updateOne: {
          filter: { dataset: datasetName, symbol, as_of: asOf },
          update: {
            $set: {
              dataset: datasetName,
              symbol,
              as_of: asOf,
              latency_sec: row.latency_sec == null ? undefined : toNumber(row.latency_sec),
              source: row.source ? String(row.source) : undefined,
              quality_flag: row.quality_flag ? String(row.quality_flag) : undefined,
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.dataset && op.updateOne.filter.as_of)

    const result = ops.length > 0 ? await db.collection('data_quality').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '数据质量导入完成')
  }

  if (dataset === 'stock_intraday') {
    const ops = records.map((row) => {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      const dateTime = String(row.datetime || row.time || '').trim()
      const period = String(row.period || '1').trim() || '1'
      return {
        updateOne: {
          filter: { symbol, datetime: dateTime, period },
          update: {
            $set: {
              symbol,
              datetime: dateTime,
              period,
              open: row.open == null ? undefined : toNumber(row.open),
              high: row.high == null ? undefined : toNumber(row.high),
              low: row.low == null ? undefined : toNumber(row.low),
              close: row.close == null ? undefined : toNumber(row.close),
              volume: row.volume == null ? undefined : toNumber(row.volume),
              amount: row.amount == null ? undefined : toNumber(row.amount),
              ...getQualityFields(row),
              updated_at: now,
              updated_by: user.userId
            },
            $setOnInsert: { created_at: now }
          },
          upsert: true
        }
      }
    }).filter((op) => op.updateOne.filter.symbol && op.updateOne.filter.datetime)

    const result = ops.length > 0 ? await db.collection('stock_intraday').bulkWrite(ops, { ordered: false }) : null
    return ok({ dataset, accepted: ops.length, matched: result?.matchedCount || 0, modified: result?.modifiedCount || 0, upserted: result?.upsertedCount || 0 }, '分时盘口导入完成')
  }

  return fail(`不支持的数据集: ${dataset}`, 400)
}
