import { NextRequest, NextResponse } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { listOperationLogs } from '@/lib/operation-logs'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const data = await listOperationLogs(user.userId, {
    page: 1,
    pageSize: 3000
  })

  const text = data.logs
    .map((row) => `[${new Date(row.created_at).toISOString()}] [${row.success ? 'INFO' : 'ERROR'}] [${row.action_type}] ${row.action}`)
    .join('\n')

  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="system-logs-${Date.now()}.txt"`
    }
  })
}
