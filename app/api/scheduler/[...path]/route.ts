import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

interface Params {
  params: Promise<{ path: string[] }>
}

function schedulerDisabledMessage(path: string[]) {
  return `接口 /api/scheduler/${path.join('/')} 已停用：系统已切换到网页现场执行模式，不再支持后台定时调度。`
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { path } = await params
  const joined = path.join('/')
  if (joined === 'stats') {
    return ok(
      {
        total_jobs: 0,
        running_jobs: 0,
        paused_jobs: 0,
        scheduler_running: false,
        scheduler_state: 0
      },
      '后台调度已停用'
    )
  }

  if (joined === 'health') {
    return ok(
      {
        status: 'disabled',
        running: false,
        state: 0,
        timestamp: new Date().toISOString()
      },
      '后台调度已停用'
    )
  }

  if (joined === 'jobs' || joined === 'history' || joined === 'executions') {
    return ok([], '后台调度已停用')
  }

  return fail(schedulerDisabledMessage(path), 410)
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { path } = await params
  return fail(schedulerDisabledMessage(path), 410)
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { path } = await params
  return fail(schedulerDisabledMessage(path), 410)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)
  const { path } = await params
  return fail(schedulerDisabledMessage(path), 410)
}
