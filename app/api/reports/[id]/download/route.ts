import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { userIdOrFilter } from '@/lib/mongo-helpers'

interface Params {
  params: Promise<{ id: string }>
}

function fmtDate(value: unknown) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  }
  return text || '-'
}

function fmtNumber(value: unknown, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  return num.toFixed(digits)
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const format = (request.nextUrl.searchParams.get('format') || 'markdown').toLowerCase()

  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const conditions: Array<Record<string, unknown>> = [{ analysis_id: id }, { execution_id: id }]
  if (ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) })
  }

  const doc = await reports.findOne({
    $and: [userIdOrFilter(user.userId), { $or: conditions }]
  })

  if (!doc) {
    return NextResponse.json({ success: false, message: '报告不存在' }, { status: 404 })
  }

  const title = `${String(doc.stock_name || doc.stock_symbol || '')}(${String(doc.stock_symbol || '')}) 分析报告`
  const nextTradingDays = Array.isArray(doc.next_trading_days) ? doc.next_trading_days : []
  const benchmarkSummary = Array.isArray(doc.benchmark_summary) ? doc.benchmark_summary : []
  const fundFlow = Array.isArray(doc.fund_flow) ? doc.fund_flow : []
  const stockEvents = Array.isArray(doc.stock_events) ? doc.stock_events : []
  const financialEnhanced = (doc.financial_enhanced && typeof doc.financial_enhanced === 'object')
    ? (doc.financial_enhanced as Record<string, unknown>)
    : null
  const newsSentimentSummary = (doc.news_sentiment_summary && typeof doc.news_sentiment_summary === 'object')
    ? (doc.news_sentiment_summary as Record<string, unknown>)
    : null
  const adjustFactors = Array.isArray(doc.adjust_factors) ? doc.adjust_factors : []
  const corporateActions = Array.isArray(doc.corporate_actions) ? doc.corporate_actions : []
  const industryAggregation = Array.isArray(doc.industry_aggregation) ? doc.industry_aggregation : []
  const earningsExpectation = Array.isArray(doc.earnings_expectation) ? doc.earnings_expectation : []
  const macroCalendar = Array.isArray(doc.macro_calendar) ? doc.macro_calendar : []
  const intradayData = Array.isArray(doc.intraday_data) ? doc.intraday_data : []
  const dataQualitySummary = (doc.data_quality_summary && typeof doc.data_quality_summary === 'object')
    ? (doc.data_quality_summary as Record<string, unknown>)
    : null
  const quantAutoFetch = (doc.quant_auto_fetch && typeof doc.quant_auto_fetch === 'object')
    ? (doc.quant_auto_fetch as Record<string, unknown>)
    : null

  const markdown = [
    `# ${title}`,
    '',
    `- 生成时间：${new Date(doc.created_at || Date.now()).toLocaleString()}`,
    `- 置信度：${Number(doc.confidence_score || 0)}`,
    `- 风险等级：${String(doc.risk_level || '-')}`,
    '',
    '## 摘要',
    '',
    String(doc.summary || ''),
    '',
    '## 建议',
    '',
    String(doc.recommendation || ''),
    '',
    '## 关键要点',
    '',
    ...(Array.isArray(doc.key_points) ? doc.key_points.map((x: unknown) => `- ${String(x)}`) : ['- 无']),
    '',
    '## 未来交易日历',
    '',
    ...(nextTradingDays.length > 0 ? nextTradingDays.map((d: unknown) => `- ${fmtDate(d)}`) : ['- 无']),
    '',
    '## 基准指数对照',
    '',
    ...(benchmarkSummary.length > 0
      ? benchmarkSummary.map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${String(item.index_code || '-')}: 最新 ${fmtNumber(item.latest_close)} / 当日 ${fmtNumber(item.day_change)}% / 20日 ${fmtNumber(item.trend_20d)}%`
      })
      : ['- 无']),
    '',
    '## 资金流（前20条）',
    '',
    ...(fundFlow.length > 0
      ? fundFlow.slice(0, 20).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${fmtDate(item.trade_date)} | 主力净流入 ${fmtNumber(item.main_inflow)} | 北向 ${fmtNumber(item.northbound_net)} | 融资 ${fmtNumber(item.margin_balance)} | 融券 ${fmtNumber(item.short_balance)}`
      })
      : ['- 无']),
    '',
    '## 公告与事件（前30条）',
    '',
    ...(stockEvents.length > 0
      ? stockEvents.slice(0, 30).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- [${fmtDate(item.event_date)}] [${String(item.event_type || '-')}] [影响:${String(item.impact || '-')}] ${String(item.title || '-')}`
      })
      : ['- 无']),
    '',
    '## 财务增强',
    '',
    ...(financialEnhanced
      ? [
          `- 报告期: ${String(financialEnhanced.report_period || '-')}`,
          `- 净利润同比: ${fmtNumber(financialEnhanced.profit_yoy)}%`,
          `- 毛利率: ${fmtNumber(financialEnhanced.gross_margin)}%`,
          `- 资产负债率: ${fmtNumber(financialEnhanced.debt_to_asset)}%`,
          `- 经营现金流: ${fmtNumber(financialEnhanced.operating_cashflow)}`,
          `- 经营现金流/净利润: ${fmtNumber(financialEnhanced.ocf_to_profit, 4)}`
        ]
      : ['- 无']),
    '',
    '## 新闻情绪摘要',
    '',
    ...(newsSentimentSummary
      ? [
          `- 样本数: ${String(newsSentimentSummary.count || 0)}`,
          `- 平均情绪分: ${fmtNumber(newsSentimentSummary.avg_sentiment, 4)}`,
          `- 高相关条数: ${String(newsSentimentSummary.high_relevance_count || 0)}`
        ]
      : ['- 无']),
    '',
    '## 复权因子（前20条）',
    '',
    ...(adjustFactors.length > 0
      ? adjustFactors.slice(0, 20).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${fmtDate(item.ex_dividend_date)} | 当次 ${fmtNumber(item.adj_factor, 6)} | 前复权 ${fmtNumber(item.fore_adj_factor, 6)} | 后复权 ${fmtNumber(item.back_adj_factor, 6)}`
      })
      : ['- 无']),
    '',
    '## 公司行为（前20条）',
    '',
    ...(corporateActions.length > 0
      ? corporateActions.slice(0, 20).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${fmtDate(item.ex_dividend_date)} [${String(item.action_type || '-')}] 现金分红:${fmtNumber(item.cash_dividend_ps, 4)} 送转:${fmtNumber(item.bonus_share_ps, 4)} 配股价:${fmtNumber(item.rights_issue_price, 4)}`
      })
      : ['- 无']),
    '',
    '## 行业聚合（前10条）',
    '',
    ...(industryAggregation.length > 0
      ? industryAggregation.slice(0, 10).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${fmtDate(item.trade_date)} ${String(item.industry_name || '-')} | 主力净流入 ${fmtNumber(item.industry_main_inflow)} | 情绪 ${fmtNumber(item.industry_sentiment)} | 热度 ${fmtNumber(item.industry_heat, 0)}`
      })
      : ['- 无']),
    '',
    '## 业绩预期（前20条）',
    '',
    ...(earningsExpectation.length > 0
      ? earningsExpectation.slice(0, 20).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${fmtDate(item.announce_date)} [${String(item.source_type || '-')}] ${String(item.forecast_type || '-')} | 净利变动 ${fmtNumber(item.profit_change_pct)}% | EPS ${fmtNumber(item.eps, 4)}`
      })
      : ['- 无']),
    '',
    '## 宏观日历（前20条）',
    '',
    ...(macroCalendar.length > 0
      ? macroCalendar.slice(0, 20).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${String(item.date || '-')} ${String(item.indicator || '-')} | 当前 ${fmtNumber(item.value, 4)} | 前值 ${fmtNumber(item.previous, 4)}`
      })
      : ['- 无']),
    '',
    '## 分时盘口（前30条）',
    '',
    ...(intradayData.length > 0
      ? intradayData.slice(0, 30).map((row: unknown) => {
        const item = row as Record<string, unknown>
        return `- ${String(item.datetime || '-')} | O ${fmtNumber(item.open, 3)} H ${fmtNumber(item.high, 3)} L ${fmtNumber(item.low, 3)} C ${fmtNumber(item.close, 3)} V ${fmtNumber(item.volume, 0)}`
      })
      : ['- 无']),
    '',
    '## 数据质量',
    '',
    ...(dataQualitySummary
      ? [
          `- 总记录: ${String(dataQualitySummary.total || 0)}`,
          `- 异常记录: ${String(dataQualitySummary.bad_count || 0)}`,
          `- 主要问题: ${Array.isArray(dataQualitySummary.top_issues) ? dataQualitySummary.top_issues.join('、') : '-'}`
        ]
      : ['- 无']),
    '',
    '## 自动补拉状态',
    '',
    ...(quantAutoFetch
      ? [
          `- 触发结果: ${Boolean(quantAutoFetch.triggered) ? '已触发' : '未触发'}`,
          `- 原因: ${String(quantAutoFetch.reason || '-')}`,
          `- 当时缺失: ${Array.isArray(quantAutoFetch.missing) ? quantAutoFetch.missing.join('、') : '-'}`
        ]
      : ['- 无'])
  ].join('\n')

  if (format === 'json') {
    return new NextResponse(JSON.stringify(doc, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${id}.json"`
      }
    })
  }

  if (format === 'pdf') {
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${id}.txt"`
      }
    })
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${id}.md"`
    }
  })
}
