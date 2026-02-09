import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  try {
    const db = await getDb()
    const names = await db.listCollections().toArray()

    const collections = [] as Array<{
      name: string
      documents: number
      size: number
      storage_size: number
      indexes: number
      index_size: number
    }>

    let totalDocuments = 0
    let totalSize = 0

    for (const item of names) {
      const name = item.name
      const docs = await db.collection(name).countDocuments()
      totalDocuments += docs
      collections.push({
        name,
        documents: docs,
        size: 0,
        storage_size: 0,
        indexes: 0,
        index_size: 0
      })
    }

    return ok(
      {
        total_collections: collections.length,
        total_documents: totalDocuments,
        total_size: totalSize,
        collections
      },
      '获取统计成功'
    )
  } catch (error) {
    return fail('获取数据库统计失败', 500, error instanceof Error ? error.message : String(error))
  }
}
