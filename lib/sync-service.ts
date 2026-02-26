import { getDb } from '@/lib/db'

async function safeFetch(url: string, timeoutMs = 30000): Promise<Response> {
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

async function fetchStockListFromEastMoney(): Promise<{ success: boolean; message: string; stocks: Array<{ symbol: string; name: string }> }> {
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14'

  try {
    const res = await safeFetch(url)
    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}`, stocks: [] }
    }

    const json = await res.json()
    const items = json?.data?.diff as Array<{ f12: string; f14: string }> | undefined

    if (!items || items.length === 0) {
      return { success: false, message: '无数据', stocks: [] }
    }

    const stocks = items
      .filter(item => item.f12 && item.f14)
      .map(item => ({
        symbol: item.f12,
        name: item.f14
      }))

    return { success: true, message: `获取 ${stocks.length} 只股票`, stocks }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : '未知错误', stocks: [] }
  }
}

export interface SyncStatusRecord {
  job: string
  status: 'idle' | 'running' | 'success' | 'success_with_errors' | 'failed' | 'never_run'
  started_at?: string
  finished_at?: string
  total: number
  inserted: number
  updated: number
  errors: number
  last_trade_date?: string
  data_sources_used: string[]
  source_stats?: Record<string, Record<string, number>>
  message?: string
  created_at: Date
}

export async function runStockBasicsSync(force = false, preferredSources?: string[]) {
  const db = await getDb()
  const basics = db.collection('stock_basic_info')
  const history = db.collection<SyncStatusRecord>('sync_history')

  const startedAt = new Date()
  const nowDate = startedAt.toISOString().slice(0, 10)

  let total = await basics.countDocuments()
  let inserted = 0
  let updated = 0
  let errors = 0
  let message = ''

  if (force || total === 0) {
    const fetchResult = await fetchStockListFromEastMoney()

    if (!fetchResult.success) {
      const status: SyncStatusRecord = {
        job: 'stock_basics_sync',
        status: 'failed',
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        total,
        inserted: 0,
        updated: 0,
        errors: 1,
        last_trade_date: nowDate,
        data_sources_used: ['eastmoney'],
        message: `获取股票列表失败: ${fetchResult.message}`,
        created_at: new Date()
      }
      await history.insertOne(status)
      return status
    }

    const stocks = fetchResult.stocks
    const now = new Date()
    const ops = stocks.map(stock => ({
      updateOne: {
        filter: { symbol: stock.symbol },
        update: {
          $set: {
            symbol: stock.symbol,
            name: stock.name,
            market: stock.symbol.startsWith('6') || stock.symbol.startsWith('9') ? '沪市' : '深市',
            source: 'eastmoney',
            updated_at: now
          },
          $setOnInsert: { created_at: now }
        },
        upsert: true
      }
    }))

    if (ops.length > 0) {
      const result = await basics.bulkWrite(ops, { ordered: false })
      inserted = result.upsertedCount
      updated = result.modifiedCount
    }

    total = await basics.countDocuments()
    message = `成功同步 ${stocks.length} 只股票`
  } else {
    message = `数据库已有 ${total} 只股票，跳过同步`
  }

  const source = preferredSources && preferredSources.length > 0 ? preferredSources : ['eastmoney']
  const status: SyncStatusRecord = {
    job: 'stock_basics_sync',
    status: 'success',
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    total,
    inserted,
    updated,
    errors,
    last_trade_date: nowDate,
    data_sources_used: source,
    source_stats: {
      primary: {
        total
      }
    },
    message,
    created_at: new Date()
  }

  await history.insertOne(status)
  return status
}

export async function getLatestSyncStatus() {
  const db = await getDb()
  const history = db.collection<SyncStatusRecord>('sync_history')
  const row = await history.find({ job: 'stock_basics_sync' }).sort({ created_at: -1 }).limit(1).next()
  if (!row) {
    return {
      job: 'stock_basics_sync',
      status: 'never_run' as const,
      total: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      data_sources_used: []
    }
  }

  const { _id: _ignored, ...record } = row
  return record
}

export async function getSyncHistory(page = 1, pageSize = 20, status?: string) {
  const db = await getDb()
  const history = db.collection<SyncStatusRecord>('sync_history')
  const skip = (page - 1) * pageSize

  const query: Record<string, unknown> = { job: 'stock_basics_sync' }
  if (status) {
    query.status = status
  }

  const [records, total] = await Promise.all([
    history.find(query).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray(),
    history.countDocuments(query)
  ])

  return {
    records: records.map(({ _id: _ignored, ...record }) => record),
    total,
    page,
    page_size: pageSize,
    has_more: skip + records.length < total
  }
}

export async function clearSyncCache() {
  const db = await getDb()
  await db.collection('sync_cache').deleteMany({})
  return { cleared: true }
}
