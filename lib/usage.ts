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
    session_id: String(row.session_id || row.analysis_id || row.execution_id || ''),
    analysis_type: String(row.analysis_type || 'analysis')
  }))
}

export async function computeUsageStatistics(userId: string) {
  const records = await loadUsageRecords(userId, 2000)

  const byProvider: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const byDate: Record<string, number> = {}

  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (const row of records) {
    totalInputTokens += row.input_tokens
    totalOutputTokens += row.output_tokens

    byProvider[row.provider] = (byProvider[row.provider] || 0) + 1
    byModel[row.model_name] = (byModel[row.model_name] || 0) + 1

    const date = String(row.timestamp).slice(0, 10)
    byDate[date] = (byDate[date] || 0) + 1
  }

  return {
    total_requests: records.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
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
