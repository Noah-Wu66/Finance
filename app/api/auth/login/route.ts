import { NextRequest, NextResponse } from 'next/server'

import { applyAuthCookie, getUserById, signUserToken, toPublicUserProfile, verifyUserPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string }
    const username = (body.username || '').trim()
    const password = body.password || ''

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名和密码不能为空'
        },
        { status: 400 }
      )
    }

    const user = await verifyUserPassword(username, password)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名或密码错误'
        },
        { status: 401 }
      )
    }

    const token = await signUserToken(user)
    const userDoc = await getUserById(user.userId)
    const userProfile = userDoc ? toPublicUserProfile(userDoc) : {
      id: user.userId,
      username: user.username,
      email: user.email || '',
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
        access_token: token,
        refresh_token: token,
        token_type: 'bearer',
        expires_in: 60 * 60 * 12,
        user: userProfile
      },
      message: '登录成功'
    })

    applyAuthCookie(response, token)
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
