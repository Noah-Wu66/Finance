import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/db'

function userFilter(userId: string) {
  if (ObjectId.isValid(userId)) {
    return {
      $or: [{ user_id: userId }, { user_id: new ObjectId(userId) }]
    }
  }

  return {
    $or: [{ user_id: userId }]
  }
}

export async function createOperationLog(input: {
  userId: string
  userEmail: string
  actionType: string
  action: string
  details?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
  durationMs?: number
  sessionId?: string
  ipAddress?: string
  userAgent?: string
}) {
  const db = await getDb()
  const now = new Date()
  const res = await db.collection('operation_logs').insertOne({
    user_id: input.userId,
    user_email: input.userEmail,
    action_type: input.actionType,
    action: input.action,
    details: input.details || {},
    success: input.success !== false,
    error_message: input.errorMessage,
    duration_ms: input.durationMs,
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
    session_id: input.sessionId,
    timestamp: now.toISOString(),
    created_at: now
  })

  return res.insertedId.toHexString()
}

export async function listOperationLogs(userId: string, options?: {
  page?: number
  pageSize?: number
  actionType?: string
  success?: boolean
  keyword?: string
}) {
  const page = Math.max(1, options?.page || 1)
  const pageSize = Math.min(200, Math.max(1, options?.pageSize || 20))
  const skip = (page - 1) * pageSize

  const andFilters: Array<Record<string, unknown>> = [userFilter(userId)]
  if (options?.actionType) {
    andFilters.push({ action_type: options.actionType })
  }
  if (typeof options?.success === 'boolean') {
    andFilters.push({ success: options.success })
  }
  if (options?.keyword) {
    andFilters.push({
      $or: [
        { action: { $regex: options.keyword, $options: 'i' } },
        { action_type: { $regex: options.keyword, $options: 'i' } },
        { error_message: { $regex: options.keyword, $options: 'i' } }
      ]
    })
  }

  const query = {
    $and: andFilters
  }

  const db = await getDb()
  const logs = db.collection('operation_logs')

  const [total, rows] = await Promise.all([
    logs.countDocuments(query),
    logs.find(query).sort({ created_at: -1 }).skip(skip).limit(pageSize).toArray()
  ])

  return {
    logs: rows.map((row) => ({
      id: String(row._id),
      user_id: String(row.user_id || ''),
      user_email: String(row.user_email || ''),
      action_type: String(row.action_type || ''),
      action: String(row.action || ''),
      details: row.details || {},
      success: Boolean(row.success),
      error_message: row.error_message ? String(row.error_message) : undefined,
      duration_ms: Number(row.duration_ms || 0),
      ip_address: row.ip_address ? String(row.ip_address) : undefined,
      user_agent: row.user_agent ? String(row.user_agent) : undefined,
      session_id: row.session_id ? String(row.session_id) : undefined,
      timestamp: row.timestamp || row.created_at,
      created_at: row.created_at
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize)
  }
}

export async function getOperationLogStats(userId: string, days = 30) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await db
    .collection('operation_logs')
    .find({
      $and: [userFilter(userId), { created_at: { $gte: cutoff } }]
    })
    .toArray()

  const total = rows.length
  const successLogs = rows.filter((row) => row.success !== false).length
  const failedLogs = total - successLogs

  const actionTypeDistribution: Record<string, number> = {}
  const hourlyDistribution: Array<{ hour: string; count: number }> = []
  const hourMap: Record<string, number> = {}

  for (const row of rows) {
    const type = String(row.action_type || 'unknown')
    actionTypeDistribution[type] = (actionTypeDistribution[type] || 0) + 1

    const hour = new Date(row.created_at || Date.now()).getHours().toString().padStart(2, '0')
    hourMap[hour] = (hourMap[hour] || 0) + 1
  }

  for (const [hour, count] of Object.entries(hourMap)) {
    hourlyDistribution.push({ hour, count })
  }

  return {
    total_logs: total,
    success_logs: successLogs,
    failed_logs: failedLogs,
    success_rate: total > 0 ? (successLogs / total) * 100 : 0,
    action_type_distribution: actionTypeDistribution,
    hourly_distribution: hourlyDistribution.sort((a, b) => a.hour.localeCompare(b.hour))
  }
}

export async function clearOperationLogs(userId: string, days?: number, actionType?: string) {
  const db = await getDb()
  const andFilters: Array<Record<string, unknown>> = [userFilter(userId)]

  if (days && days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    andFilters.push({ created_at: { $lt: cutoff } })
  }

  if (actionType) {
    andFilters.push({ action_type: actionType })
  }

  const query = {
    $and: andFilters
  }

  const res = await db.collection('operation_logs').deleteMany(query)
  return {
    deleted_count: res.deletedCount,
    filter: query
  }
}
