import { getDb } from '@/lib/db'

/**
 * 从东方财富 API 拉取 A 股最新行情 + 近期 K 线，写入 MongoDB。
 * 在分析任务启动时自动调用，确保数据库里有最新数据。
 *
 * K 线接口使用日期范围参数（beg/end），无论是否开盘都能获取历史数据。
 * 实时行情接口仅在交易时段返回数据，非交易时段会自动跳过。
 *
 * 东方财富接口无需 API Key，免费可用。
 */

// ---------- 类型 ----------

interface EastMoneyQuoteRaw {
  f2: number   // 最新价
  f3: number   // 涨跌幅
  f4: number   // 涨跌额
  f5: number   // 成交量（手）
  f6: number   // 成交额
  f7: number   // 振幅
  f8: number   // 换手率
  f9: number   // 市盈率(动)
  f10: number  // 量比
  f12: string  // 代码
  f14: string  // 名称
  f15: number  // 最高
  f16: number  // 最低
  f17: number  // 今开
  f18: number  // 昨收
  f20: number  // 总市值
  f21: number  // 流通市值
  f23: number  // 市净率
  f100: string // 行业
  f103: string // 代码前缀
}

// ---------- 工具函数 ----------

/** 根据 6 位代码判断沪/深市场前缀（行情接口用） */
function getSecId(code: string): string {
  // 6/9 开头 → 上海(1.)，其余 → 深圳(0.)
  if (code.startsWith('6') || code.startsWith('9')) {
    return `1.${code}`
  }
  return `0.${code}`
}

/** 根据 6 位代码判断 SH/SZ 前缀（个股资料接口用） */
function getMarketPrefix(code: string): string {
  if (code.startsWith('6') || code.startsWith('9')) {
    return `SH${code}`
  }
  return `SZ${code}`
}

/** 计算 N 天前的日期字符串 YYYYMMDD */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** 安全 fetch，带超时 */
async function safeFetch(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ---------- 拉取实时行情 ----------

export async function fetchRealtimeQuote(code: string): Promise<{
  success: boolean
  message: string
  data?: Record<string, unknown>
}> {
  const secId = getSecId(code)
  const fields = 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f100,f103'
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secId}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbbd1`

  try {
    const res = await safeFetch(url)
    if (!res.ok) {
      return { success: false, message: `东方财富接口返回 HTTP ${res.status}` }
    }

    const json = await res.json()
    const d = json?.data as EastMoneyQuoteRaw | undefined
    if (!d || !d.f12) {
      // 非交易时段接口返回空数据是正常的，不算错误
      return { success: false, message: '非交易时段，实时行情不可用' }
    }

    const now = new Date()
    const tradeDate = now.toISOString().slice(0, 10).replace(/-/g, '')

    const doc = {
      symbol: code,
      stock_code: code,
      code: code,
      name: d.f14 || code,
      close: d.f2,
      pct_chg: d.f3,
      change: d.f4,
      volume: d.f5 * 100,        // 手 → 股
      amount: d.f6,
      amplitude: d.f7,
      turnover_rate: d.f8,
      pe: d.f9,
      volume_ratio: d.f10,
      high: d.f15,
      low: d.f16,
      open: d.f17,
      pre_close: d.f18,
      total_mv: d.f20,
      circ_mv: d.f21,
      pb: d.f23,
      industry: d.f100 || '',
      trade_date: tradeDate,
      data_source: 'eastmoney_realtime',
      updated_at: now,
      created_at: now
    }

    // 写入 MongoDB
    const db = await getDb()
    await db.collection('stock_quotes').updateOne(
      { symbol: code, trade_date: tradeDate, data_source: 'eastmoney_realtime' },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true }
    )

    return {
      success: true,
      message: `已拉取 ${d.f14}(${code}) 最新行情：${d.f2}`,
      data: doc
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    if (msg.includes('abort')) {
      return { success: false, message: '东方财富接口请求超时' }
    }
    return { success: false, message: `拉取实时行情失败: ${msg}` }
  }
}

// ---------- 拉取近期 K 线（使用日期范围，收盘后也能获取） ----------

export async function fetchDailyKline(code: string, days = 60): Promise<{
  success: boolean
  message: string
  count: number
  stockName?: string
}> {
  const secId = getSecId(code)
  const begDate = daysAgo(days)
  const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  // 使用 beg/end 日期范围参数（与 AkShare 一致），无论是否开盘都能获取历史数据
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&beg=${begDate}&end=${endDate}&ut=7eea3edcaed734bea9cbfc24409ed989`

  try {
    const res = await safeFetch(url)
    if (!res.ok) {
      return { success: false, message: `K线接口返回 HTTP ${res.status}`, count: 0 }
    }

    const json = await res.json()
    const klines = json?.data?.klines as string[] | undefined
    const stockName = json?.data?.name as string | undefined

    if (!klines || klines.length === 0) {
      return { success: false, message: '未获取到K线数据，可能股票代码不存在', count: 0 }
    }

    const db = await getDb()
    const now = new Date()
    let upserted = 0

    for (const line of klines) {
      // 格式: 日期,开,收,高,低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率
      const parts = line.split(',')
      if (parts.length < 11) continue

      const tradeDate = parts[0].replace(/-/g, '')
      const doc: Record<string, unknown> = {
        symbol: code,
        stock_code: code,
        code: code,
        name: stockName || code,
        trade_date: tradeDate,
        open: Number(parts[1]),
        close: Number(parts[2]),
        high: Number(parts[3]),
        low: Number(parts[4]),
        volume: Number(parts[5]),
        amount: Number(parts[6]),
        amplitude: Number(parts[7]),
        pct_chg: Number(parts[8]),
        change: Number(parts[9]),
        turnover_rate: Number(parts[10]),
        data_source: 'eastmoney_kline',
        updated_at: now
      }

      await db.collection('stock_quotes').updateOne(
        { symbol: code, trade_date: tradeDate, data_source: 'eastmoney_kline' },
        { $set: doc, $setOnInsert: { created_at: now } },
        { upsert: true }
      )
      upserted++
    }

    return {
      success: true,
      message: `已拉取 ${stockName || code} 近 ${upserted} 天K线数据`,
      count: upserted,
      stockName
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    if (msg.includes('abort')) {
      return { success: false, message: 'K线接口请求超时', count: 0 }
    }
    return { success: false, message: `拉取K线失败: ${msg}`, count: 0 }
  }
}

// ---------- 拉取财务数据（ROE + 营收增长率 + PE + PB） ----------

export async function fetchFinancialData(code: string): Promise<{
  success: boolean
  message: string
  data?: { roe: number; revenueGrowth: number; pe: number; pb: number; reportDate: string }
}> {
  try {
    // 并行请求两个接口：业绩报表（ROE/营收/BPS） + 估值数据（PE/收盘价）
    const yjbbColumns = 'SECURITY_CODE,SECURITY_NAME_ABBR,REPORTDATE,WEIGHTAVG_ROE,YSTZ,BPS'
    const yjbbFilter = `(SECURITY_CODE="${code}")`
    const yjbbUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=NOTICE_DATE,SECURITY_CODE&sortTypes=-1,1&pageSize=1&pageNumber=1&reportName=RPT_LICO_FN_CPD&columns=${yjbbColumns}&filter=${encodeURIComponent(yjbbFilter)}`

    const valColumns = 'SECURITY_CODE,TRADE_DATE,PE_DYNAMIC,CLOSE_PRICE'
    const valFilter = `(SECURITY_CODE="${code}")`
    const valUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=TRADE_DATE&sortTypes=-1&pageSize=1&pageNumber=1&reportName=RPT_DMSK_TS_STOCKNEW&columns=${valColumns}&filter=${encodeURIComponent(valFilter)}`

    const [yjbbRes, valRes] = await Promise.all([
      safeFetch(yjbbUrl),
      safeFetch(valUrl)
    ])

    // 解析业绩报表
    let roe = 0
    let revenueGrowth = 0
    let bps = 0
    let reportDate = ''
    let stockName = code

    if (yjbbRes.ok) {
      const yjbbJson = await yjbbRes.json()
      const row = yjbbJson?.result?.data?.[0]
      if (row) {
        roe = Number(row.WEIGHTAVG_ROE ?? 0)
        revenueGrowth = Number(row.YSTZ ?? 0)
        bps = Number(row.BPS ?? 0)
        reportDate = (row.REPORTDATE as string || '').slice(0, 10)
        stockName = row.SECURITY_NAME_ABBR || code
      }
    }

    // 解析估值数据
    let pe = 0
    let closePrice = 0

    if (valRes.ok) {
      const valJson = await valRes.json()
      const row = valJson?.result?.data?.[0]
      if (row) {
        pe = Number(row.PE_DYNAMIC ?? 0)
        closePrice = Number(row.CLOSE_PRICE ?? 0)
      }
    }

    // 用收盘价和每股净资产计算 PB
    const pb = bps > 0 && closePrice > 0 ? Number((closePrice / bps).toFixed(4)) : 0

    // 如果两个接口都没拿到数据
    if (!reportDate && !pe) {
      return { success: false, message: '未获取到财务数据' }
    }

    const now = new Date()
    const db = await getDb()

    // 写入 financial_data 集合
    await db.collection('financial_data').updateOne(
      { symbol: code, report_date: reportDate || 'latest' },
      {
        $set: {
          symbol: code,
          code: code,
          name: stockName,
          roe,
          pe,
          pb,
          revenue_yoy: revenueGrowth,
          bps,
          report_date: reportDate,
          data_source: 'eastmoney_yjbb',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    )

    return {
      success: true,
      message: `已拉取 ${stockName}(${code}) 财务数据：ROE ${roe.toFixed(2)}%，PE ${pe.toFixed(2)}，PB ${pb.toFixed(2)}，营收增长 ${revenueGrowth.toFixed(2)}%`,
      data: { roe, revenueGrowth, pe, pb, reportDate }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    if (msg.includes('abort')) {
      return { success: false, message: '财务数据接口请求超时' }
    }
    return { success: false, message: `拉取财务数据失败: ${msg}` }
  }
}

// ---------- 拉取个股资料（行业分类，不受交易时段限制） ----------

export async function fetchStockProfile(code: string): Promise<{
  success: boolean
  message: string
  data?: { industry: string; industryDetail: string }
}> {
  const marketCode = getMarketPrefix(code)
  const url = `https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=${marketCode}`

  try {
    const res = await safeFetch(url)
    if (!res.ok) {
      return { success: false, message: `个股资料接口返回 HTTP ${res.status}` }
    }

    const json = await res.json()
    const info = json?.jbzl?.[0]
    if (!info) {
      return { success: false, message: '未获取到个股资料' }
    }

    // EM2016 是东方财富的详细行业分类，如 "信息技术-计算机软件-行业应用软件"
    // INDUSTRYCSRC1 是证监会行业分类
    const industryDetail = (info.EM2016 as string) || ''
    // 取最后一级作为简短行业名
    const parts = industryDetail.split('-')
    const industry = parts[parts.length - 1] || (info.INDUSTRYCSRC1 as string || '').split('-').pop() || ''

    if (!industry) {
      return { success: false, message: '个股资料中无行业信息' }
    }

    return {
      success: true,
      message: `已拉取 ${code} 行业信息：${industry}`,
      data: { industry, industryDetail }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    if (msg.includes('abort')) {
      return { success: false, message: '个股资料接口请求超时' }
    }
    return { success: false, message: `拉取个股资料失败: ${msg}` }
  }
}

// ---------- 一键拉取（实时 + K线 + 财务 + 行业） ----------

export async function fetchAStockData(code: string): Promise<{
  success: boolean
  message: string
  realtime: { success: boolean; message: string }
  kline: { success: boolean; message: string; count: number }
  financial: { success: boolean; message: string }
  profile: { success: boolean; message: string }
}> {
  const normalized = code.trim().replace(/\.(SH|SZ|BJ)$/i, '')

  // 校验：必须是 6 位数字
  if (!/^[0-9]{6}$/.test(normalized)) {
    return {
      success: false,
      message: `${code} 不是有效的 A 股代码（需要 6 位数字）`,
      realtime: { success: false, message: '跳过' },
      kline: { success: false, message: '跳过', count: 0 },
      financial: { success: false, message: '跳过' },
      profile: { success: false, message: '跳过' }
    }
  }

  // ---------- 时效性检查：10 分钟内拉取过则跳过，避免重复调用外部接口 ----------
  const FRESHNESS_MS = 10 * 60 * 1000
  const db = await getDb()
  const latestQuote = await db.collection('stock_quotes').findOne(
    { symbol: normalized, data_source: 'eastmoney_kline' },
    { sort: { updated_at: -1 }, projection: { updated_at: 1 } }
  )
  if (latestQuote?.updated_at && (Date.now() - new Date(latestQuote.updated_at as string | Date).getTime()) < FRESHNESS_MS) {
    return {
      success: true,
      message: `${normalized} 数据在 10 分钟内已拉取过，跳过重复请求`,
      realtime: { success: true, message: '使用缓存数据' },
      kline: { success: true, message: '使用缓存数据', count: 0 },
      financial: { success: true, message: '使用缓存数据' },
      profile: { success: true, message: '使用缓存数据' }
    }
  }

  // ---------- 并行拉取所有数据 ----------
  const [realtime, kline, financial, profile] = await Promise.all([
    fetchRealtimeQuote(normalized),
    fetchDailyKline(normalized, 60),
    fetchFinancialData(normalized),
    fetchStockProfile(normalized)
  ])

  // ---------- 统一合并写入 stock_basic_info（原本 4 个子函数各写 1 次，现在合并为 1 次） ----------
  const now = new Date()
  const basicInfoPatch: Record<string, unknown> = {
    symbol: normalized,
    code: normalized,
    market: 'A股',
    source: 'eastmoney',
    updated_at: now
  }

  // 从实时行情获取：名称、行业、市值、PE、PB
  if (realtime.success && realtime.data) {
    const d = realtime.data
    if (d.name) basicInfoPatch.name = d.name
    if (d.industry) basicInfoPatch.industry = d.industry
    if (d.total_mv) basicInfoPatch.total_mv = d.total_mv
    if (d.pe) basicInfoPatch.pe = d.pe
    if (d.pb) basicInfoPatch.pb = d.pb
  }

  // 从 K 线获取：名称（如果实时行情没拿到）
  if (kline.success && kline.stockName && !basicInfoPatch.name) {
    basicInfoPatch.name = kline.stockName
  }

  // 从财务数据获取：ROE、PE、PB（更精确，覆盖实时行情的粗略值）、营收增长
  if (financial.success && financial.data) {
    basicInfoPatch.roe = financial.data.roe
    if (financial.data.pe) basicInfoPatch.pe = financial.data.pe
    if (financial.data.pb) basicInfoPatch.pb = financial.data.pb
    basicInfoPatch.revenue_yoy = financial.data.revenueGrowth
  }

  // 从个股资料获取：详细行业分类（覆盖实时行情的粗略行业）
  if (profile.success && profile.data) {
    if (profile.data.industry) basicInfoPatch.industry = profile.data.industry
    basicInfoPatch.industry_detail = profile.data.industryDetail
  }

  // 一次性写入
  await db.collection('stock_basic_info').updateOne(
    { $or: [{ symbol: normalized }, { code: normalized }] },
    { $set: basicInfoPatch, $setOnInsert: { created_at: now } },
    { upsert: true }
  )

  // K 线是核心数据，只要 K 线成功就算成功
  const success = kline.success
  const parts: string[] = []

  if (kline.success) parts.push(kline.message)
  if (realtime.success) parts.push(realtime.message)
  if (financial.success) parts.push(financial.message)
  if (profile.success) parts.push(profile.message)

  const msg = success
    ? `${normalized} 数据拉取完成：${parts.join('；')}`
    : `${normalized} 数据拉取失败：K线=${kline.message}`

  return {
    success,
    message: msg,
    realtime,
    kline,
    financial,
    profile
  }
}
