import { promises as fs } from 'fs'
import path from 'path'

import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { learningArticles } from '@/lib/learning-content'

interface Params {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const article = learningArticles.find((item) => item.id === params.id)
  if (!article) {
    return fail('文章不存在', 404)
  }

  try {
    const candidates = [path.resolve(process.cwd(), article.filePath), path.resolve(process.cwd(), '..', article.filePath)]

    let content = ''
    let loaded = false
    for (const fullPath of candidates) {
      try {
        content = await fs.readFile(fullPath, 'utf-8')
        loaded = true
        break
      } catch {
      }
    }

    if (!loaded) {
      return fail('文章文件不存在', 404)
    }

    return ok(
      {
        id: article.id,
        title: article.title,
        category: article.category,
        summary: article.summary,
        content
      },
      '获取文章成功'
    )
  } catch (error) {
    return fail('读取文章失败', 500, error instanceof Error ? error.message : String(error))
  }
}
