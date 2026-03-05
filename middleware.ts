import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_PAGES = ['/login', '/register']
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/reset-password',
  '/api/health'
]

const ADMIN_API_PREFIXES = [
  '/api/config',
  '/api/system',
  '/api/cache/clear',
  '/api/quant-data/import'
]

const ADMIN_PAGE_PREFIXES = [
  '/settings/database',
  '/settings/cache',
  '/settings/logs',
  '/settings/system-logs',
  '/settings/scheduler'
]

interface AccessPayload {
  userId?: string
  email?: string
  isAdmin?: boolean
  token_kind?: 'access' | 'refresh'
}

const jwtSecretText = (process.env.JWT_SECRET || '').trim()
if (!jwtSecretText) {
  throw new Error('JWT_SECRET 环境变量未设置，服务拒绝启动')
}
const jwtSecretValue = new TextEncoder().encode(jwtSecretText)

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAdminApi(pathname: string) {
  return ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAdminPage(pathname: string) {
  return ADMIN_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function extractAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim() || null
  }

  return request.cookies.get('ta_token')?.value || null
}

async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretValue)
    const data = payload as AccessPayload
    if (data.token_kind !== 'access') {
      return null
    }
    return data
  } catch {
    return null
  }
}

function unauthorizedApi(message: string) {
  return NextResponse.json(
    {
      success: false,
      message
    },
    { status: 401 }
  )
}

function forbiddenApi(message: string) {
  return NextResponse.json(
    {
      success: false,
      message
    },
    { status: 403 }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isApi = pathname.startsWith('/api')
  const token = extractAccessToken(request)
  const tokenPayload = token ? await verifyAccessToken(token) : null

  if (isApi) {
    if (isPublicApi(pathname)) {
      return NextResponse.next()
    }

    if (!tokenPayload) {
      return unauthorizedApi('未登录')
    }

    if (isAdminApi(pathname) && !tokenPayload.isAdmin) {
      return forbiddenApi('仅管理员可访问')
    }

    return NextResponse.next()
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    if (tokenPayload) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (!tokenPayload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAdminPage(pathname) && !tokenPayload.isAdmin) {
    return NextResponse.redirect(new URL('/settings', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\.).*)']
}
