import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { inferMarketFromCode } from '@/lib/market'
import { createOperationLog } from '@/lib/operation-logs'

const EXEC_COLLECTION = 'web_executions'
const REPORT_COLLECTION = 'analysis_reports'
const BATCH_COLLECTION = 'web_batches'

const STALE_TIMEOUT_MS = 35 * 1000

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

async function createUsageRecord(input: {
  userId: string
  provider: string
  modelName: string
  inputTokens: number
  outputTokens: number
  cost: number
  analysisId: string
}) {
  try {
    const db = await getDb()
    await db.collection('usage_records').insertOne({
      user_id: input.userId,
      timestamp: new Date().toISOString(),
      provider: input.provider,
      model_name: input.modelName,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cost: input.cost,
      currency: 'CNY',
      session_id: input.analysisId,
      analysis_type: 'single_analysis',
      created_at: new Date()
    })
  } catch {
  }
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
  const names = ['stock_basic_info', 'stock_basics', 'stocks']

  let foundName = symbol
  let foundIndustry = ''
  let foundSource = 'none'

  for (const name of names) {
    const coll = db.collection(name)
    const doc = await coll.findOne({
      $or: [
        { symbol },
        { code: symbol },
        { ts_code: { $regex: `^${symbol}` } }
      ]
    })

    if (doc) {
      foundSource = name
      foundName = (doc.name as string | undefined) || symbol
      foundIndustry = (doc.industry as string | undefined) || ''
      break
    }
  }

  // 如果行业信息为空，尝试从 stock_quotes 的实时行情记录中补充
  if (!foundIndustry) {
    const quoteDoc = await db.collection('stock_quotes').findOne(
      {
        $or: [{ symbol }, { stock_code: symbol }, { code: symbol }],
        data_source: 'eastmoney_realtime',
        industry: { $exists: true, $ne: '' }
      },
      { sort: { trade_date: -1, updated_at: -1 } }
    )
    if (quoteDoc?.industry) {
      foundIndustry = quoteDoc.industry as string
      // 如果名称还是默认值，也从这里补充
      if (foundName === symbol && quoteDoc.name) {
        foundName = quoteDoc.name as string
      }
    }
  }

  return {
    source: foundSource,
    symbol,
    name: foundName,
    industry: foundIndustry || '未知行业'
  }
}

async function loadQuotePack(symbol: string) {
  const db = await getDb()
  const names = ['stock_quotes', 'stock_daily_quotes', 'quotes', 'quotes_realtime']

  for (const name of names) {
    const coll = db.collection(name)
    const rows = await coll
      .find({
        $or: [{ symbol }, { stock_code: symbol }, { code: symbol }, { ts_code: { $regex: `^${symbol}` } }]
      })
      .sort({ trade_date: -1, date: -1, timestamp: -1, updated_at: -1, created_at: -1 })
      .limit(30)
      .toArray()

    if (rows.length > 0) {
      const latest = rows[0]
      const latestClose = Number(latest.close ?? latest.price ?? latest.last ?? 0)
      const prevClose = Number(rows[rows.length - 1].close ?? rows[rows.length - 1].price ?? latestClose)
      const changePct = prevClose > 0 ? ((latestClose - prevClose) / prevClose) * 100 : 0

      return {
        source: name,
        latestClose,
        prevClose,
        changePct,
        samples: rows.length
      }
    }
  }

  return {
    source: 'none',
    latestClose: 0,
    prevClose: 0,
    changePct: 0,
    samples: 0
  }
}

async function loadFundamentals(symbol: string) {
  const db = await getDb()

  // 1) 优先从专用财务集合读取（如果将来有数据写入）
  const financialNames = ['financial_data', 'stock_financial_data', 'financial_reports']
  for (const name of financialNames) {
    const coll = db.collection(name)
    const doc = await coll.findOne(
      {
        $or: [{ symbol }, { stock_code: symbol }, { code: symbol }, { ts_code: { $regex: `^${symbol}` } }]
      },
      {
        sort: { report_date: -1, updated_at: -1, created_at: -1 }
      }
    )

    if (doc) {
      return {
        source: name,
        roe: Number(doc.roe ?? doc.roe_avg ?? 0),
        pe: Number(doc.pe ?? doc.pe_ttm ?? 0),
        pb: Number(doc.pb ?? 0),
        revenueGrowth: Number(doc.revenue_yoy ?? doc.revenue_growth ?? 0)
      }
    }
  }

  // 2) 从 stock_basic_info 读取 PE/PB（东方财富实时行情写入的）
  const basicDoc = await db.collection('stock_basic_info').findOne(
    { $or: [{ symbol }, { code: symbol }] },
    { sort: { updated_at: -1 } }
  )
  if (basicDoc && (basicDoc.pe || basicDoc.pb)) {
    return {
      source: 'stock_basic_info',
      roe: Number(basicDoc.roe ?? 0),
      pe: Number(basicDoc.pe ?? 0),
      pb: Number(basicDoc.pb ?? 0),
      revenueGrowth: Number(basicDoc.revenue_yoy ?? basicDoc.revenue_growth ?? 0)
    }
  }

  // 3) 从 stock_quotes 实时行情记录读取 PE/PB
  const quoteDoc = await db.collection('stock_quotes').findOne(
    {
      $or: [{ symbol }, { stock_code: symbol }, { code: symbol }],
      data_source: 'eastmoney_realtime'
    },
    { sort: { trade_date: -1, updated_at: -1 } }
  )
  if (quoteDoc && (quoteDoc.pe || quoteDoc.pb)) {
    return {
      source: 'stock_quotes',
      roe: 0,
      pe: Number(quoteDoc.pe ?? 0),
      pb: Number(quoteDoc.pb ?? 0),
      revenueGrowth: 0
    }
  }

  return {
    source: 'none',
    roe: 0,
    pe: 0,
    pb: 0,
    revenueGrowth: 0
  }
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

async function buildReport(execution: ExecutionDoc) {
  const db = await getDb()
  const reports = db.collection(REPORT_COLLECTION)

  const basic = execution.context.basic as { name: string; industry: string }
  const quote = execution.context.quote as { latestClose: number; changePct: number }
  const financial = execution.context.financial as { roe: number; pe: number; pb: number; revenueGrowth: number }
  const decision = execution.context.decision as { action: string; risk: string; confidence: number }

  const summary = `${basic.name}（${execution.symbol}）当前价格 ${quote.latestClose.toFixed(2)}，阶段涨跌 ${quote.changePct.toFixed(2)}%。结合财务指标（ROE ${financial.roe.toFixed(2)}%，PE ${financial.pe.toFixed(2)}）给出${decision.action}观点。`
  const recommendation = `建议：${decision.action}。风险等级：${decision.risk}。若继续观察，请重点跟踪行业景气与成交量变化。`

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
    confidence_score: decision.confidence,
    risk_level: decision.risk,
    key_points: [
      `行业：${basic.industry}`,
      `价格：${quote.latestClose.toFixed(2)}，阶段变化 ${quote.changePct.toFixed(2)}%`,
      `ROE：${financial.roe.toFixed(2)}%，PE：${financial.pe.toFixed(2)}，PB：${financial.pb.toFixed(2)}`
    ],
    reports: {
      live_execution: {
        basic,
        quote,
        financial,
        decision
      }
    },
    analysts: ['现场执行引擎'],
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
    confidence_score: decision.confidence,
    risk_level: decision.risk,
    key_points: doc.key_points
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
    total_steps: 5,
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
    logs.push({ at: now, text: `已加载基础信息：${basic.name}（${basic.source}）` })
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
    const quote = context.quote as { changePct: number }
    const financial = context.financial as { roe: number; pe: number; pb: number }
    const decision = makeDecision(quote.changePct, financial.roe, financial.pe, financial.pb)
    context.decision = decision
    logs.push({ at: now, text: `生成投资观点：${decision.action}（置信度 ${decision.confidence}%）` })

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
    logs.push({ at: now, text: '报告已生成，现场执行完成。' })

    await createNotificationSafe({
      userId,
      type: 'analysis',
      title: `${execution.symbol} 分析完成`,
      content: '报告已生成，可直接打开查看。',
      link: `/reports/${report.report_id}`,
      source: 'analysis'
    })

    await createUsageRecord({
      userId,
      provider: 'live-engine',
      modelName: 'local-evaluator',
      inputTokens: 3200,
      outputTokens: 1600,
      cost: 0,
      analysisId: report.analysis_id
    })

    await createOperationLogSafe({
      userId,
      userEmail: execution.user_email,
      actionType: 'report_generation',
      action: `${execution.symbol} 分析完成并生成报告`,
      success: true,
      details: {
        report_id: report.report_id,
        analysis_id: report.analysis_id
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
