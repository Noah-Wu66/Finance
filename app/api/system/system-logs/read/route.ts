import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { listOperationLogs } from '@/lib/operation-logs'

interface Payload {
  filename?: string
  lines?: number
  level?: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG'
  keyword?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  let body: Payload = {}
  try {
    body = (await request.json()) as Payload
  } catch {
  }

  const count = Math.min(500, Math.max(1, Number(body.lines || 200)))
  const data = await listOperationLogs(user.userId, {
    page: 1,
    pageSize: count,
    keyword: body.keyword
  })

  const rows = data.logs.map((row) => {
    const level = row.success ? 'INFO' : 'ERROR'
    return `[${new Date(row.created_at).toISOString()}] [${level}] [${row.action_type}] ${row.action}${row.error_message ? ` | ${row.error_message}` : ''}`
  })

  const stats = {
    total_lines: data.total,
    filtered_lines: rows.length,
    error_count: data.logs.filter((x) => !x.success).length,
    warning_count: 0,
    info_count: data.logs.filter((x) => x.success).length,
    debug_count: 0
  }

  return ok(
    {
      filename: body.filename || 'operation.log',
      lines: rows,
      stats
    },
    '读取日志成功'
  )
}
