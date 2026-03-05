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

declare global {
  var __financeApiRateStore: Map<string, number[]> | undefined
}

const jwtSecretText = (process.env.JWT_SECRET || '').trim()
if (!jwtSecretText) {
  throw new Error('JWT_SECRET 环境变量未设置，服务拒绝启动')
}
const jwtSecretValue = new TextEncoder().encode(jwtSecretText)

const apiRateStore = globalThis.__financeApiRateStore || new Map<string, number[]>()
if (!globalThis.__financeApiRateStore) {
  globalThis.__financeApiRateStore = apiRateStore
}

function hitRateLimit(key: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now()
  const beginAt = now - windowMs
  const current = (apiRateStore.get(key) || []).filter((ts) => ts > beginAt)
  current.push(now)
  apiRateStore.set(key, current)

  if (current.length > maxCount) {
    return true
  }

  if (apiRateStore.size > 3000) {
    for (const [k, values] of apiRateStore.entries()) {
      const alive = values.filter((ts) => ts > now - 5 * 60 * 1000)
      if (alive.length === 0) {
        apiRateStore.delete(k)
      } else {
        apiRateStore.set(k, alive)
      }
    }
  }

  return false
}

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

function tooManyRequestsApi(message: string) {
  return NextResponse.json(
    {
      success: false,
      message
    },
    { status: 429 }
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

    const requester = tokenPayload.userId || request.headers.get('x-forwarded-for') || 'unknown'
    if (hitRateLimit(`api:all:${requester}`, 240, 60 * 1000)) {
      return tooManyRequestsApi('请求过于频繁，请稍后再试')
    }

    if (pathname.includes('/api/executions/') && pathname.endsWith('/tick')) {
      if (hitRateLimit(`api:tick:${requester}`, 20, 30 * 1000)) {
        return tooManyRequestsApi('任务推进太频繁，请稍后重试')
      }
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

