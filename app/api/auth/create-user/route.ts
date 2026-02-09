import { NextRequest } from 'next/server'

import { createUserAccount, getRequestUser, getUserById, toPublicUserProfile } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'

interface Payload {
  email?: string
  password?: string
  nickname?: string
  is_admin?: boolean
}

export async function POST(request: NextRequest) {
  const current = await getRequestUser(request)
  if (!current) return fail('未登录', 401)
  if (!current.isAdmin) return fail('仅管理员可创建用户', 403)

  const body = (await request.json().catch(() => ({}))) as Payload
  const email = (body.email || '').trim()
  const password = body.password || ''
  const nickname = (body.nickname || '').trim()

  if (!email || !password) {
    return fail('邮箱和密码不能为空', 400)
  }

  const db = await getDb()
  const exists = await db.collection('users').findOne({ email })
  if (exists) {
    return fail('邮箱已存在', 409)
  }

  const user = await createUserAccount({
    email,
    password,
    nickname: nickname || undefined,
    isAdmin: body.is_admin === true
  })

  if (!user) return fail('创建失败', 500)
  return ok(toPublicUserProfile(user), '用户创建成功')
}
