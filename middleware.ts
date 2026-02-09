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

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('ta_token')?.value
  const authHeader = request.headers.get('authorization') || ''
  const hasBearer = authHeader.toLowerCase().startsWith('bearer ')
  const isApi = pathname.startsWith('/api')

  if (isApi) {
    if (isPublicApi(pathname)) {
      return NextResponse.next()
    }

    if (!token && !hasBearer) {
      return NextResponse.json(
        {
          success: false,
          message: '未登录'
        },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\.).*)']
}
