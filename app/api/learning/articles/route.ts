import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { learningArticles } from '@/lib/learning-content'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    learningArticles.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      summary: item.summary
    })),
    '获取学习文章成功'
  )
}
