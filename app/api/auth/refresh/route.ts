import { NextRequest, NextResponse } from 'next/server'

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  applyAuthCookies,
  getRefreshRequestUser,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '@/lib/auth'

interface Payload {
  refresh_token?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload
    const userFromCookie = await getRefreshRequestUser(request)
    const userFromToken = body.refresh_token ? await verifyRefreshToken(body.refresh_token) : null
    const user = userFromCookie || userFromToken

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '刷新令牌无效'
        },
        { status: 401 }
      )
    }

    const accessToken = await signAccessToken(user)
    const refreshToken = await signRefreshToken(user)
    const response = NextResponse.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: ACCESS_TOKEN_MAX_AGE_SECONDS
      },
      message: 'Token刷新成功'
    })

    applyAuthCookies(response, { accessToken, refreshToken })
    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Token刷新失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
