import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { hasMairuiLicence, mairuiApi } from '@/lib/mairui-data'

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
  { code: '000001', codeWithMarket: '000001.SH', name: '上证指数' },
  { code: '399001', codeWithMarket: '399001.SZ', name: '深证成指' },
  { code: '899050', codeWithMarket: '899050.BJ', name: '北证50' },
  { code: '399006', codeWithMarket: '399006.SZ', name: '创业板指' }
]

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return [value as T]
  return []
}

async function fetchRealtimeIndex(code: string): Promise<IndexItem | null> {
  try {
    const row = asArray<Record<string, unknown>>(await mairuiApi.hsindex.realTime(code))[0]
    if (!row) return null
    return {
      code,
      name: String(row.mc || row.name || ''),
      price: toNum(row.p),
      change: toNum(row.ud),
      pct_chg: toNum(row.pc),
      open: toNum(row.o),
      high: toNum(row.h),
      low: toNum(row.l),
      pre_close: toNum(row.yc),
      volume: toNum(row.v),
      amount: toNum(row.cje)
    }
  } catch {
    return null
  }
}

async function fetchKlineIndex(codeWithMarket: string, code: string, name: string): Promise<IndexItem | null> {
  try {
    const rows = asArray<Record<string, unknown>>(await mairuiApi.hsindex.history(codeWithMarket, 'd', { lt: 10 }))
    if (rows.length === 0) return null
    const row = rows[rows.length - 1]
    const close = toNum(row.c)
    const preClose = toNum(row.pc)
    return {
      code,
      name: String(row.mc || name),
      price: close,
      change: close - preClose,
      pct_chg: toNum(row.zf || row.pc),
      open: toNum(row.o),
      high: toNum(row.h),
      low: toNum(row.l),
      pre_close: preClose,
      volume: toNum(row.v),
      amount: toNum(row.a)
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  if (!hasMairuiLicence()) return fail('未配置 MAIRUI_LICENCE', 503)

  const results: IndexItem[] = []
  const realtimeList = await Promise.all(INDEX_LIST.map((item) => fetchRealtimeIndex(item.code)))

  const fallbackTasks: Promise<{ index: number; item: IndexItem | null }>[] = []
  for (let i = 0; i < INDEX_LIST.length; i++) {
    if (realtimeList[i]) {
      results[i] = realtimeList[i] as IndexItem
    } else {
      const cfg = INDEX_LIST[i]
      fallbackTasks.push(fetchKlineIndex(cfg.codeWithMarket, cfg.code, cfg.name).then((item) => ({ index: i, item })))
    }
  }

  if (fallbackTasks.length > 0) {
    const fallbackResults = await Promise.all(fallbackTasks)
    for (const { index, item } of fallbackResults) {
      const cfg = INDEX_LIST[index]
      results[index] = item || {
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
      }
    }
  }

  return ok(results, '获取指数行情成功')
}
