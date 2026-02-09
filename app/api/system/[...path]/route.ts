import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail } from '@/lib/http'

interface Params {
  params: { path: string[] }
}

function message(path: string[]) {
  return `接口 /api/system/${path.join('/')} 未在现场执行模式中启用。`
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  return fail(message(params.path), 410)
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  return fail(message(params.path), 410)
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  return fail(message(params.path), 410)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  return fail(message(params.path), 410)
}
