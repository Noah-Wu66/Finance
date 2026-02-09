import { NextRequest } from 'next/server'

import { getRequestUser, getUserById, toPublicUserProfile, updateUserProfile } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface UpdatePayload {
  email?: string
  preferences?: Record<string, unknown>
  daily_quota?: number
  concurrent_limit?: number
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const doc = await getUserById(user.userId)
  if (!doc) {
    return fail('用户不存在', 404)
  }

  return ok(toPublicUserProfile(doc), '获取当前用户成功')
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePayload
  const doc = await updateUserProfile(user.userId, {
    email: body.email,
    preferences: body.preferences,
    daily_quota: body.daily_quota,
    concurrent_limit: body.concurrent_limit
  })

  if (!doc) {
    return fail('更新失败', 400)
  }

  return ok(toPublicUserProfile(doc), '用户信息已更新')
}
