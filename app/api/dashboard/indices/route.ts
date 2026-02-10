import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

/**
 * 从东方财富实时获取 4 大指数行情
 * 上证指数 1.000001 / 深证成指 0.399001 / 北证50 0.899050 / 创业板指 0.399006
 *
 * 实时接口拿不到数据时，自动请求历史 K 线接口获取最近一个交易日的数据
 */

interface IndexItem {
  code: string
  name: string
  price: number
  change: number
  pct_chg: number
  open: number
  high: number
  low: number
  pre_close: number
  volume: number
  amount: number
}

const INDEX_LIST = [
  { secId: '1.000001', code: '000001', name: '上证指数' },
  { secId: '0.399001', code: '399001', name: '深证成指' },
  { secId: '0.899050', code: '899050', name: '北证50' },
  { secId: '0.399006', code: '399006', name: '创业板指' }
]

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://quote.eastmoney.com/'
}

async function safeFetch(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS })
  } finally {
    clearTimeout(timer)
  }
}

/** 实时行情接口 */
async function fetchRealtimeIndex(secId: string): Promise<IndexItem | null> {
  const fields = 'f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18'
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secId}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbbd1`

  try {
    const res = await safeFetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const d = json?.data
    if (!d || !d.f12) return null

    return {
      code: String(d.f12),
      name: String(d.f14 || ''),
      price: Number(d.f2 || 0),
      change: Number(d.f4 || 0),
      pct_chg: Number(d.f3 || 0),
      open: Number(d.f17 || 0),
      high: Number(d.f15 || 0),
      low: Number(d.f16 || 0),
      pre_close: Number(d.f18 || 0),
      volume: Number(d.f5 || 0),
      amount: Number(d.f6 || 0)
    }
  } catch {
    return null
  }
}

/** 历史 K 线接口（取最近一个交易日，不受交易时段限制） */
async function fetchKlineIndex(secId: string, name: string): Promise<IndexItem | null> {
  const end = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const beg = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10).replace(/-/g, '')
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&beg=${beg}&end=${end}&ut=7eea3edcaed734bea9cbfc24409ed989`

  try {
    const res = await safeFetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const klines = json?.data?.klines as string[] | undefined
    const code = json?.data?.code as string | undefined
    const kName = json?.data?.name as string | undefined
    if (!klines || klines.length === 0) return null

    // 取最后一条（最近交易日）
    // 格式: 日期,开,收,高,低,成交量,成交额,振幅,涨跌幅,涨跌额,换手率
    const last = klines[klines.length - 1]
    const p = last.split(',')
    if (p.length < 11) return null

    return {
      code: code || secId.split('.')[1],
      name: kName || name,
      price: Number(p[2]),       // 收盘价
      change: Number(p[9]),      // 涨跌额
      pct_chg: Number(p[8]),     // 涨跌幅
      open: Number(p[1]),
      high: Number(p[3]),
      low: Number(p[4]),
      pre_close: Number(p[2]) - Number(p[9]),  // 收盘价 - 涨跌额 = 昨收
      volume: Number(p[5]),
      amount: Number(p[6])
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const results: IndexItem[] = []

  // 先并行请求所有实时数据
  const fetches = await Promise.all(INDEX_LIST.map((item) => fetchRealtimeIndex(item.secId)))

  // 收集需要走历史接口的
  const fallbackTasks: Promise<{ index: number; item: IndexItem | null }>[] = []
  for (let i = 0; i < INDEX_LIST.length; i++) {
    if (fetches[i]) {
      results[i] = fetches[i]!
    } else {
      const cfg = INDEX_LIST[i]
      fallbackTasks.push(
        fetchKlineIndex(cfg.secId, cfg.name).then((item) => ({ index: i, item }))
      )
    }
  }

  // 并行请求历史数据
  if (fallbackTasks.length > 0) {
    const fallbackResults = await Promise.all(fallbackTasks)
    for (const { index, item } of fallbackResults) {
      const cfg = INDEX_LIST[index]
      results[index] = item || {
        code: cfg.code,
        name: cfg.name,
        price: 0, change: 0, pct_chg: 0,
        open: 0, high: 0, low: 0, pre_close: 0,
        volume: 0, amount: 0
      }
    }
  }

  return ok(results, '获取指数行情成功')
}
