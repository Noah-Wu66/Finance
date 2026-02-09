import { NextRequest, NextResponse } from 'next/server'

import { applyAuthCookie, createUserAccount, signUserToken, toPublicUserProfile } from '@/lib/auth'
import { getDb } from '@/lib/db'

interface RegisterPayload {
  username?: string
  email?: string
  password?: string
  confirm_password?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterPayload
    const username = (body.username || '').trim()
    const email = (body.email || '').trim()
    const password = body.password || ''
    const confirmPassword = body.confirm_password || ''

    if (!username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名、邮箱、密码不能为空'
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

    const db = await getDb()
    const users = db.collection('users')
    const exists = await users.findOne({ $or: [{ username }, { email }] })
    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名或邮箱已存在'
        },
        { status: 409 }
      )
    }

    const userDoc = await createUserAccount({
      username,
      email,
      password,
      isAdmin: false
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

    const token = await signUserToken({
      userId: String(userDoc._id),
      username,
      isAdmin: false,
      email
    })

    const response = NextResponse.json({
      success: true,
      data: {
        access_token: token,
        refresh_token: token,
        token_type: 'bearer',
        expires_in: 60 * 60 * 12,
        user: toPublicUserProfile(userDoc)
      },
      message: '注册成功'
    })

    applyAuthCookie(response, token)
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
