import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const days = Math.max(1, Number(request.nextUrl.searchParams.get('days') || '7'))
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const db = await getDb()
  const res = await db.collection('app_cache').deleteMany({ created_at: { $lt: cutoff } })

  return ok(
    {
      deleted: res.deletedCount,
      cutoff: cutoff.toISOString()
    },
    '过期缓存已清理'
  )
}
