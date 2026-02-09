import { NextRequest, NextResponse } from 'next/server'

import { applyAuthCookie, getRequestUser, signUserToken, verifyUserToken } from '@/lib/auth'

interface Payload {
  refresh_token?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload
    const userFromCookie = await getRequestUser(request)
    const userFromToken = body.refresh_token ? await verifyUserToken(body.refresh_token) : null
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

    const token = await signUserToken(user)
    const response = NextResponse.json({
      success: true,
      data: {
        access_token: token,
        refresh_token: token,
        expires_in: 60 * 60 * 12
      },
      message: 'Token刷新成功'
    })
    applyAuthCookie(response, token)
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
