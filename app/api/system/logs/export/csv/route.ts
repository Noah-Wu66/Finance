import { NextRequest, NextResponse } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { listOperationLogs } from '@/lib/operation-logs'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const actionType = request.nextUrl.searchParams.get('action_type') || undefined
  const data = await listOperationLogs(user.userId, {
    page: 1,
    pageSize: 2000,
    actionType
  })

  const headers = ['id', 'action_type', 'action', 'success', 'created_at']
  const lines = [headers.join(',')]
  for (const item of data.logs) {
    lines.push(
      [
        item.id,
        item.action_type,
        `"${String(item.action).replace(/"/g, '""')}"`,
        item.success ? 'true' : 'false',
        item.created_at
      ].join(',')
    )
  }

  const csv = lines.join('\n')
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="operation-logs-${Date.now()}.csv"`
    }
  })
}
