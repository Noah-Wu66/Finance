import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { getOrSetLocalCache } from '@/lib/local-data-cache'
import { daysAgoYmd, todayYmd, tusharePost } from '@/lib/tushare-data'
import { toNum, toYmd } from '@/lib/utils'

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

interface DashboardIndexMeta {
  code: string
  name: string
  indexTsCode: string
}

const DASHBOARD_INDEXES: DashboardIndexMeta[] = [
  { code: '000300', name: '沪深300', indexTsCode: '000300.SH' },
  { code: '000016', name: '上证50', indexTsCode: '000016.SH' },
  { code: '000905', name: '中证500', indexTsCode: '000905.SH' },
  { code: '399006', name: '创业板指', indexTsCode: '399006.SZ' }
]

const INDEX_FIELDS = ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'change', 'pct_chg', 'vol', 'amount']

function pickLatestRow(rows: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (rows.length === 0) return null
  return rows.sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))[0]
}

async function readLatestIndexFromDb(indexCode: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  const row = await db
    .collection('index_daily')
    .find({ index_code: indexCode })
    .sort({ trade_date: -1, updated_at: -1 })
    .limit(1)
    .next()

  if (!row) return null

  return {
    trade_date: row.trade_date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    pre_close: row.pre_close,
    change: row.change,
    pct_chg: row.pct_chg,
    vol: row.volume ?? row.vol,
    amount: row.amount
  }
}

async function persistIndexRow(index: DashboardIndexMeta, row: Record<string, unknown>) {
  const tradeDate = toYmd(row.trade_date)
  if (!tradeDate) return

  const db = await getDb()
  const now = new Date()
  await db.collection('index_daily').updateOne(
    { index_code: index.code, trade_date: tradeDate },
    {
      $set: {
        index_code: index.code,
        index_name: index.name,
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
        source: 'tushare_index_daily',
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    },
    { upsert: true }
  )
}

async function fetchLatestIndexRow(index: DashboardIndexMeta): Promise<Record<string, unknown> | null> {
  try {
    const today = todayYmd()
    const rows = await tusharePost(
      'index_daily',
      { ts_code: index.indexTsCode, start_date: daysAgoYmd(10), end_date: today },
      INDEX_FIELDS
    )
    const latest = pickLatestRow(rows)
    if (latest) {
      await persistIndexRow(index, latest)
      return latest
    }
  } catch {
  }

  return readLatestIndexFromDb(index.code)
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  try {
    const rows = await Promise.all(
      DASHBOARD_INDEXES.map((index) =>
        getOrSetLocalCache(`dashboard-index:${index.indexTsCode}`, () => fetchLatestIndexRow(index)).catch(() => null)
      )
    )

    const items: IndexItem[] = DASHBOARD_INDEXES.map((index, idx) => {
      const row = (rows[idx] || {}) as Record<string, unknown>
      return {
        code: index.code,
        name: index.name,
        price: toNum(row.close),
        change: toNum(row.change),
        pct_chg: toNum(row.pct_chg),
        open: toNum(row.open),
        high: toNum(row.high),
        low: toNum(row.low),
        pre_close: toNum(row.pre_close),
        volume: toNum(row.vol ?? row.volume),
        amount: toNum(row.amount)
      }
    })

    return ok(items, rows.some((row) => Boolean(row)) ? '获取指数行情成功' : '暂无指数行情数据')
  } catch (error) {
    return fail('获取指数行情失败', 500, error instanceof Error ? error.message : String(error))
  }
}
