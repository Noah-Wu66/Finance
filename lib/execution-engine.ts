import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'
import { fetchAStockData } from '@/lib/fetch-a-stock'
import { inferMarketFromCode } from '@/lib/market'
import { createOperationLog } from '@/lib/operation-logs'
import { analyzeWithAI, isAIEnabled } from '@/lib/ai-client'

const EXEC_COLLECTION = 'web_executions'
const REPORT_COLLECTION = 'analysis_reports'
const BATCH_COLLECTION = 'web_batches'

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

interface SearchState {
  phase: 'search' | 'read' | 'done'
  searchRound: number
  readRound: number
  news: NewsItem[]
  readPages: ReadPageItem[]
  searchLogs: SearchRoundLog[]
  seenLinks: string[]
  readUrls: string[]
  consecutiveSkips: number
}

function initSearchState(): SearchState {
  return {
    phase: 'search',
    searchRound: 0,
    readRound: 0,
    news: [],
    readPages: [],
    searchLogs: [],
    seenLinks: [],
    readUrls: [],
    consecutiveSkips: 0
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

  if (state.searchRound === 0) {
    const firstQuery = `${stockName} ${symbol} 最新消息 股票`
    const firstResult = await metasoSearch(firstQuery)
    
    for (const w of firstResult.webpages) {
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
      }
    }
    
    state.seenLinks = Array.from(seenLinks)
    state.searchLogs.push({ round: 1, query: firstQuery, resultCount: firstResult.webpages.length })
    state.searchRound = 1
    
    if (!aiEnabled) {
      state.phase = 'done'
      return { state, log: `第 1 轮搜索获取 ${firstResult.webpages.length} 条结果（AI 未启用，跳过后续搜索）`, done: true }
    }
    return { state, log: `搜索第 1 轮：${firstQuery}，获取 ${firstResult.webpages.length} 条结果`, done: false }
  }

  if (state.searchRound >= 10) {
    state.phase = 'read'
    return { state, log: '搜索已达 10 轮上限，进入网页深度阅读阶段', done: false }
  }

  const currentNewsSummary = state.news.map((n, i) =>
    `${i + 1}. [${n.date}] ${n.title}\n   ${n.snippet}`
  ).join('\n')

  const decisionPrompt = `你是一位股票研究员，正在为 ${stockName}（${symbol}，${industry}行业）收集新闻资讯。

当前已收集到 ${state.news.length} 条新闻：
${currentNewsSummary}

请判断：
1. 当前新闻是否已经足够全面地覆盖了该股票的最新动态、行业趋势、政策影响、财报信息等？
2. 如果不够，还需要搜索什么关键词来补充？

请严格按以下JSON格式回复（不要包含其他文字）：
{"enough": true或false, "next_query": "如果不够，填写下一次搜索的关键词，要具体精准"}`

  try {
    const decision = await analyzeWithAI({
      systemPrompt: '你是一位专业的股票研究助手，帮助判断新闻收集是否充分。只输出JSON，不要输出其他内容。',
      messages: [{ role: 'user', content: decisionPrompt }],
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
        state.phase = 'read'
        return { state, log: 'AI 响应解析失败，进入网页深度阅读阶段', done: false }
      }
    }

    if (parsed.enough === true || !parsed.next_query) {
      state.phase = 'read'
      return { state, log: `AI 判断新闻已充分，共 ${state.searchRound} 轮搜索，进入网页深度阅读阶段`, done: false }
    }

    const nextQuery = String(parsed.next_query)
    const result = await metasoSearch(nextQuery)
    
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
    state.searchLogs.push({ round: state.searchRound + 1, query: nextQuery, resultCount: result.webpages.length })
    state.searchRound += 1

    if (newCount === 0) {
      state.phase = 'read'
      return { state, log: `第 ${state.searchRound} 轮无新增结果，进入网页深度阅读阶段`, done: false }
    }
    
    return { state, log: `搜索第 ${state.searchRound} 轮：${nextQuery}，获取 ${result.webpages.length} 条结果，新增 ${newCount} 条`, done: false }
  } catch (e) {
    state.phase = 'read'
    return { state, log: `第 ${state.searchRound + 1} 轮 AI 判断失败，进入网页深度阅读阶段`, done: false }
  }
}

async function executeOneReadRound(
  state: SearchState,
  stockName: string,
  symbol: string,
  industry: string
): Promise<{ state: SearchState; log: string; done: boolean }> {
  const readUrls = new Set(state.readUrls)
  
  if (state.readRound >= 10) {
    state.phase = 'done'
    return { state, log: `网页深度阅读已达 10 次上限，共阅读 ${state.readPages.length} 个网页`, done: true }
  }

  const newsList = state.news.map((n, i) =>
    `${i + 1}. [${n.date}] [相关度:${n.score}] ${n.title}\n   链接: ${n.link}\n   摘要: ${n.snippet}`
  ).join('\n')

  const alreadyRead = state.readPages.length > 0
    ? '\n\n已深度阅读的网页：\n' + state.readPages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`).join('\n')
    : ''

  const readPrompt = `你是一位股票研究员，正在为 ${stockName}（${symbol}，${industry}行业）做深度研究。

以下是搜索到的所有新闻（共 ${state.news.length} 条）：
${newsList}
${alreadyRead}

请判断：是否有某个网页的内容特别重要，需要打开查看完整内容来获取更详细的信息？
比如：重要的财报分析、深度研报、重大政策解读、关键的公司公告等。

请严格按以下JSON格式回复（不要包含其他文字）：
{"need_read": true或false, "url": "如果需要阅读，填写要打开的网页链接", "reason": "为什么要阅读这个网页"}`

  try {
    const decision = await analyzeWithAI({
      systemPrompt: '你是一位专业的股票研究助手，帮助判断是否需要深入阅读某个网页。只输出JSON，不要输出其他内容。',
      messages: [{ role: 'user', content: readPrompt }],
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
        state.phase = 'done'
        return { state, log: 'AI 响应解析失败，结束深度阅读', done: true }
      }
    }

    if (parsed.need_read !== true || !parsed.url) {
      state.phase = 'done'
      return { state, log: `AI 判断无需继续阅读网页，共深度阅读 ${state.readPages.length} 个网页`, done: true }
    }

    const targetUrl = String(parsed.url)
    const reason = String(parsed.reason || '')

    if (readUrls.has(targetUrl)) {
      state.consecutiveSkips++
      if (state.consecutiveSkips >= 3) {
        state.phase = 'done'
        return { state, log: 'AI 连续建议已读过的网页，结束深度阅读', done: true }
      }
      state.readRound++
      return { state, log: `网页已阅读过，跳过：${targetUrl}`, done: false }
    }
    
    state.consecutiveSkips = 0
    readUrls.add(targetUrl)
    state.readUrls = Array.from(readUrls)
    state.readRound++

    const pageContent = await metasoReadPage(targetUrl)

    if (pageContent) {
      const matchingNews = state.news.find(n => n.link === targetUrl)
      state.readPages.push({
        url: targetUrl,
        title: matchingNews?.title || targetUrl,
        content: pageContent
      })
      return { state, log: `深度阅读第 ${state.readRound} 个网页：${reason}（${pageContent.length} 字符）`, done: false }
    } else {
      return { state, log: `网页读取失败：${targetUrl}`, done: false }
    }
  } catch {
    state.phase = 'done'
    return { state, log: `第 ${state.readRound + 1} 次网页阅读判断失败，结束深度阅读`, done: true }
  }
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

  const systemPrompt = `你是一位顶级量化分析师和技术分析专家。你需要基于提供的股票数据、最新新闻资讯和深度阅读的网页内容进行深度分析，并预测未来10个交易日的K线走势。

你的分析必须严格基于数据，包括：
1. 技术面分析：K线形态、趋势、支撑位/压力位、成交量变化
2. 基本面分析：估值水平、盈利能力、行业地位
3. 消息面分析：结合最新新闻资讯和深度阅读的网页内容，分析利好利空因素、政策影响、行业动态
4. 综合研判：多空力量对比、风险评估
5. K线预测：基于当前趋势、技术形态和消息面，预测未来10个交易日的OHLCV数据

重要要求：
- 预测K线必须合理，价格变动幅度要符合该股票的历史波动率
- 新闻和深度阅读内容中的重大利好/利空要体现在预测走势中
- 日期从最后一个交易日之后开始，跳过周末（周六周日）
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

【最新新闻资讯（共${news.length}条）】
${newsSummary}
${readPagesSummary ? `\n【深度阅读的网页内容（共${readPagesData.length}篇）】\n${readPagesSummary}` : ''}

请严格按以下JSON格式输出（不要包含任何其他文字、不要用markdown代码块包裹）：
{
  "summary": "200字以内的综合分析摘要，必须包含对新闻面的分析",
  "recommendation": "明确的操作建议（做多/做空/观望），包含具体的入场点位、止损位、目标位",
  "risk_level": "低/中低/中/中高/高",
  "confidence": 0到100的整数,
  "key_points": ["要点1", "要点2", "要点3", "要点4", "要点5"],
  "predicted_kline": [
    {"time": "从${lastDate}之后的下一个交易日开始，格式YYYYMMDD", "open": 数字, "high": 数字, "low": 数字, "close": 数字, "volume": 数字},
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
          time: String(k.time || ''),
          open: Number(k.open ?? 0),
          high: Number(k.high ?? 0),
          low: Number(k.low ?? 0),
          close: Number(k.close ?? 0),
          volume: Number(k.volume ?? 0)
        }))
      : []

    return {
      ai_summary: String(parsed.summary || ''),
      ai_recommendation: String(parsed.recommendation || ''),
      ai_risk_level: String(parsed.risk_level || '中'),
      ai_confidence: Number(parsed.confidence ?? 70),
      ai_key_points: Array.isArray(parsed.key_points)
        ? (parsed.key_points as string[]).map(String)
        : [],
      predicted_kline: predictedKline
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
    const decision = makeDecision(quote.changePct, financial.roe, financial.pe, financial.pb)
    context.decision = decision
    logs.push({ at: now, text: `基础研判：${decision.action}（置信度 ${decision.confidence}%）` })

    // 加载K线历史数据
    const klineData = await loadKlineHistory(execution.symbol, 60)
    context.kline_history = klineData
    logs.push({ at: now, text: `已加载 ${klineData.length} 条K线历史数据` })

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
