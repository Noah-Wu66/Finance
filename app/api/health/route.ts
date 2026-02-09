import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      runtime: 'next-node24',
      timestamp: new Date().toISOString()
    },
    message: '服务正常'
  })
}
