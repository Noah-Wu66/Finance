import { compare } from 'bcryptjs'
import { NextRequest } from 'next/server'

import { getRequestUser, updateUserPassword } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { fail, ok } from '@/lib/http'
import { maybeObjectId } from '@/lib/mongo-helpers'

interface Payload {
  old_password?: string
  new_password?: string
  confirm_password?: string
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const body = (await request.json().catch(() => ({}))) as Payload
  const oldPassword = body.old_password || ''
  const newPassword = body.new_password || ''
  const confirmPassword = body.confirm_password || ''

  if (!oldPassword || !newPassword) {
    return fail('旧密码和新密码不能为空', 400)
  }
  if (newPassword.length < 6) {
    return fail('新密码长度至少6位', 400)
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    return fail('两次新密码不一致', 400)
  }

  const userObjectId = maybeObjectId(user.userId)
  if (!userObjectId) return fail('用户ID无效', 400)

  const db = await getDb()
  const doc = await db.collection('users').findOne({ _id: userObjectId })
  if (!doc) return fail('用户不存在', 404)

  const currentHash =
    (doc.hashed_password as string | undefined) ||
    (doc.password_hash as string | undefined) ||
    (doc.password as string | undefined) ||
    ''

  let matched = false
  if (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$') || currentHash.startsWith('$2y$')) {
    matched = await compare(oldPassword, currentHash)
  } else {
    matched = oldPassword === currentHash
  }

  if (!matched) {
    return fail('旧密码错误', 400)
  }

  await updateUserPassword(user.userId, newPassword)
  return ok(undefined, '密码修改成功')
}
