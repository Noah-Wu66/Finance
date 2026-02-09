import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { userIdOrFilter } from '@/lib/mongo-helpers'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const format = (request.nextUrl.searchParams.get('format') || 'markdown').toLowerCase()

  const db = await getDb()
  const reports = db.collection('analysis_reports')

  const conditions: Array<Record<string, unknown>> = [{ analysis_id: id }, { execution_id: id }]
  if (ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) })
  }

  const doc = await reports.findOne({
    $and: [userIdOrFilter(user.userId), { $or: conditions }]
  })

  if (!doc) {
    return NextResponse.json({ success: false, message: '报告不存在' }, { status: 404 })
  }

  const title = `${String(doc.stock_name || doc.stock_symbol || '')}(${String(doc.stock_symbol || '')}) 分析报告`
  const markdown = [
    `# ${title}`,
    '',
    `- 生成时间：${new Date(doc.created_at || Date.now()).toLocaleString()}`,
    `- 置信度：${Number(doc.confidence_score || 0)}`,
    `- 风险等级：${String(doc.risk_level || '-')}`,
    '',
    '## 摘要',
    '',
    String(doc.summary || ''),
    '',
    '## 建议',
    '',
    String(doc.recommendation || ''),
    '',
    '## 关键要点',
    '',
    ...(Array.isArray(doc.key_points) ? doc.key_points.map((x: unknown) => `- ${String(x)}`) : ['- 无'])
  ].join('\n')

  if (format === 'json') {
    return new NextResponse(JSON.stringify(doc, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${id}.json"`
      }
    })
  }

  if (format === 'pdf') {
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${id}.txt"`
      }
    })
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${id}.md"`
    }
  })
}
