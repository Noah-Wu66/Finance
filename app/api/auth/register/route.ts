import { NextRequest, NextResponse } from 'next/server'

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  applyAuthCookies,
  createUserAccount,
  isEmailTaken,
  normalizeEmail,
  signAccessToken,
  signRefreshToken,
  toPublicUserProfile
} from '@/lib/auth'
import { getDb } from '@/lib/db'

interface RegisterPayload {
  email?: string
  password?: string
  confirm_password?: string
  nickname?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterPayload
    const email = normalizeEmail(body.email || '')
    const password = body.password || ''
    const confirmPassword = body.confirm_password || ''
    const nickname = (body.nickname || '').trim()

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '邮箱和密码不能为空'
        },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: '两次输入的密码不一致'
        },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: '密码长度至少6位'
        },
        { status: 400 }
      )
    }

    const exists = await isEmailTaken(email)
    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: '邮箱已存在'
        },
        { status: 409 }
      )
    }

    // 仅第一个注册用户自动成为管理员
    const db = await getDb()
    const users = db.collection('users')
    const userCount = await users.countDocuments()
    const isAdmin = userCount === 0

    const userDoc = await createUserAccount({
      email,
      password,
      nickname: nickname || undefined,
      isAdmin
    })

    if (!userDoc) {
      return NextResponse.json(
        {
          success: false,
          message: '注册失败'
        },
        { status: 500 }
      )
    }

    const sessionUser = {
      userId: String(userDoc._id),
      email,
      isAdmin,
      nickname: nickname || undefined
    }
    const accessToken = await signAccessToken(sessionUser)
    const refreshToken = await signRefreshToken(sessionUser)

    const response = NextResponse.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE_SECONDS,
        user: toPublicUserProfile(userDoc)
      },
      message: '注册成功'
    })

    applyAuthCookies(response, { accessToken, refreshToken })
    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: '注册失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
