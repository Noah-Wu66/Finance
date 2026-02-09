import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'

interface UserFilterResult {
  $or: Array<Record<string, unknown>>
}

function userFilter(userId: string): UserFilterResult {
  if (ObjectId.isValid(userId)) {
    return {
      $or: [{ user_id: userId }, { user_id: new ObjectId(userId) }]
    }
  }

  return {
    $or: [{ user_id: userId }]
  }
}

export async function loadUsageRecords(userId: string, limit = 100) {
  const db = await getDb()
  const records = db.collection('usage_records')

  const query = userFilter(userId)
  const rows = await records.find(query).sort({ timestamp: -1, created_at: -1 }).limit(limit).toArray()

  return rows.map((row) => ({
    id: String(row._id),
    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    provider: String(row.provider || 'live-engine'),
    model_name: String(row.model_name || row.model || 'local-evaluator'),
    input_tokens: Number(row.input_tokens || 0),
    output_tokens: Number(row.output_tokens || 0),
    cost: Number(row.cost || 0),
    currency: String(row.currency || 'CNY'),
    session_id: String(row.session_id || row.analysis_id || row.execution_id || ''),
    analysis_type: String(row.analysis_type || 'analysis')
  }))
}

export async function computeUsageStatistics(userId: string) {
  const records = await loadUsageRecords(userId, 2000)

  const byProvider: Record<string, { count: number; cost: number }> = {}
  const byModel: Record<string, { count: number; cost: number }> = {}
  const byDate: Record<string, { count: number; cost: number }> = {}
  const costByCurrency: Record<string, number> = {}

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0

  for (const row of records) {
    totalInputTokens += row.input_tokens
    totalOutputTokens += row.output_tokens
    totalCost += row.cost

    if (!byProvider[row.provider]) byProvider[row.provider] = { count: 0, cost: 0 }
    byProvider[row.provider].count += 1
    byProvider[row.provider].cost += row.cost

    if (!byModel[row.model_name]) byModel[row.model_name] = { count: 0, cost: 0 }
    byModel[row.model_name].count += 1
    byModel[row.model_name].cost += row.cost

    const date = String(row.timestamp).slice(0, 10)
    if (!byDate[date]) byDate[date] = { count: 0, cost: 0 }
    byDate[date].count += 1
    byDate[date].cost += row.cost

    if (!costByCurrency[row.currency]) costByCurrency[row.currency] = 0
    costByCurrency[row.currency] += row.cost
  }

  return {
    total_requests: records.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost: totalCost,
    cost_by_currency: costByCurrency,
    by_provider: byProvider,
    by_model: byModel,
    by_date: byDate
  }
}

export async function deleteOldUsageRecords(userId: string, days = 90) {
  const db = await getDb()
  const records = db.collection('usage_records')
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const query = {
    ...userFilter(userId),
    timestamp: { $lt: cutoff.toISOString() }
  }

  const res = await records.deleteMany(query)
  return {
    deleted: res.deletedCount,
    cutoff: cutoff.toISOString()
  }
}
