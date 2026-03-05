import { NextRequest, NextResponse } from 'next/server'

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  applyAuthCookies,
  getUserById,
  signAccessToken,
  signRefreshToken,
  toPublicUserProfile,
  verifyUserPassword,
  normalizeEmail
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = normalizeEmail(body.email || '')
    const password = body.password || ''

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '邮箱和密码不能为空'
        },
        { status: 400 }
      )
    }

    const user = await verifyUserPassword(email, password)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '邮箱或密码错误'
        },
        { status: 401 }
      )
    }

    const accessToken = await signAccessToken(user)
    const refreshToken = await signRefreshToken(user)
    const userDoc = await getUserById(user.userId)
    const userProfile = userDoc ? toPublicUserProfile(userDoc) : {
      id: user.userId,
      email: user.email,
      nickname: user.nickname,
      is_active: true,
      is_verified: false,
      is_admin: user.isAdmin,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      preferences: {},
      daily_quota: 1000,
      concurrent_limit: 3,
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0
    }

    const response = NextResponse.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: ACCESS_TOKEN_MAX_AGE_SECONDS,
        user: userProfile
      },
      message: '登录成功'
    })

    applyAuthCookies(response, { accessToken, refreshToken })
    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: '登录失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

