import { NextRequest } from 'next/server'

import { getRequestUser, getUserById, toPublicUserProfile, updateUserProfile } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface UpdatePayload {
  email?: string
  nickname?: string
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

  if (!user.isAdmin) {
    if (body.email !== undefined || body.daily_quota !== undefined || body.concurrent_limit !== undefined) {
      return fail('普通用户不能修改邮箱或配额', 403)
    }
  }

  try {
    const doc = await updateUserProfile(user.userId, {
      email: user.isAdmin ? body.email : undefined,
      nickname: body.nickname,
      preferences: body.preferences,
      daily_quota: user.isAdmin ? body.daily_quota : undefined,
      concurrent_limit: user.isAdmin ? body.concurrent_limit : undefined
    })

    if (!doc) {
      return fail('更新失败', 400)
    }

    return ok(toPublicUserProfile(doc), '用户信息已更新')
  } catch (error) {
    return fail('更新失败', 400, error instanceof Error ? error.message : String(error))
  }
}
