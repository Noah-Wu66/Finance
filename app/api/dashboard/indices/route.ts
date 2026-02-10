import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

/**
 * 从东方财富实时获取 4 大指数行情
 * 上证指数 1.000001 / 深证成指 0.399001 / 北证50 0.899050 / 创业板指 0.399006
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

async function fetchIndex(secId: string): Promise<Record<string, number | string> | null> {
  const fields = 'f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18'
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secId}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbbd1`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const json = await res.json()
    return json?.data || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const results: IndexItem[] = []

  const fetches = await Promise.all(INDEX_LIST.map((item) => fetchIndex(item.secId)))

  for (let i = 0; i < INDEX_LIST.length; i++) {
    const cfg = INDEX_LIST[i]
    const d = fetches[i]

    if (d && d.f12) {
      results.push({
        code: cfg.code,
        name: String(d.f14 || cfg.name),
        price: Number(d.f2 || 0),
        change: Number(d.f4 || 0),
        pct_chg: Number(d.f3 || 0),
        open: Number(d.f17 || 0),
        high: Number(d.f15 || 0),
        low: Number(d.f16 || 0),
        pre_close: Number(d.f18 || 0),
        volume: Number(d.f5 || 0),
        amount: Number(d.f6 || 0)
      })
    } else {
      // 非交易时段可能拿不到，放个空壳
      results.push({
        code: cfg.code,
        name: cfg.name,
        price: 0,
        change: 0,
        pct_chg: 0,
        open: 0,
        high: 0,
        low: 0,
        pre_close: 0,
        volume: 0,
        amount: 0
      })
    }
  }

  return ok(results, '获取指数行情成功')
}
