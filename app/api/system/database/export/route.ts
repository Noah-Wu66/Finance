import { NextRequest, NextResponse } from 'next/server'

import { getRequestUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const payload = {
    success: true,
    message: '现场执行模式导出说明',
    data: {
      note: '请使用 MongoDB 官方工具执行导出，网页端不生成服务端文件。',
      timestamp: new Date().toISOString()
    }
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="database-export-note-${Date.now()}.json"`
    }
  })
}
