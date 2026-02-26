import { getDb } from '@/lib/db'
import { fetchAStockList, hasMairuiLicence } from '@/lib/mairui-data'

async function fetchStockListFromMairui(): Promise<{ success: boolean; message: string; stocks: Array<{ symbol: string; name: string; jys?: string }> }> {
  try {
    const result = await fetchAStockList()
    if (!result.success || !result.data) {
      return { success: false, message: result.message, stocks: [] }
    }

    const stocks = result.data
      .filter((item) => item.dm && item.mc)
      .map((item) => ({
        symbol: String(item.dm).trim().toUpperCase().replace(/\.(SH|SZ|BJ)$/i, ''),
        name: String(item.mc).trim(),
        jys: item.jys
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

export async function runStockBasicsSync(force = false, _preferredSources?: string[]) {
  void _preferredSources
  const db = await getDb()
  const basics = db.collection('stock_basic_info')
  const history = db.collection<SyncStatusRecord>('sync_history')

  const startedAt = new Date()
  const nowDate = startedAt.toISOString().slice(0, 10)

  let total = await basics.countDocuments()
  let inserted = 0
  let updated = 0
  const errors = 0
  let message = ''
  const selectedSource = 'mairui'

  if (force || total === 0) {
    if (!hasMairuiLicence()) {
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
        data_sources_used: [selectedSource],
        message: '未配置 MAIRUI_LICENCE，无法同步股票列表',
        created_at: new Date()
      }
      await history.insertOne(status)
      return status
    }

    const fetchResult = await fetchStockListFromMairui()
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
        data_sources_used: [selectedSource],
        message: `获取股票列表失败: ${fetchResult.message}`,
        created_at: new Date()
      }
      await history.insertOne(status)
      return status
    }

    const stocks = fetchResult.stocks
    const now = new Date()
    const ops = stocks.map((stock) => ({
      updateOne: {
        filter: { symbol: stock.symbol },
        update: {
          $set: {
            symbol: stock.symbol,
            name: stock.name,
            market: stock.jys === 'sh' || stock.symbol.startsWith('6') || stock.symbol.startsWith('9') ? '沪市' : '深市',
            source: selectedSource,
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
    data_sources_used: [selectedSource],
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
