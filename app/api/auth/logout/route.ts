import { NextRequest, NextResponse } from 'next/server'

import { clearAuthCookie } from '@/lib/auth'

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: '已退出登录'
  })

  clearAuthCookie(response)
  return response
}
