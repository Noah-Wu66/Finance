import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { LOCAL_CACHE_ONE_MINUTE_MS, getOrSetLocalCache } from '@/lib/local-data-cache'
import { fetchAStockProfileSummary, fetchAStockQuote } from '@/lib/mairui-data'

function toNum(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface Params {
  params: Promise<{ market: string; code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()

  const [profileResult, quoteResult] = await Promise.all([
    getOrSetLocalCache(`profile:${code}`, () => fetchAStockProfileSummary(code), LOCAL_CACHE_ONE_MINUTE_MS),
    getOrSetLocalCache(`quote:cached:${code}`, () => fetchAStockQuote(code), LOCAL_CACHE_ONE_MINUTE_MS)
  ])

  if (!profileResult.success && !quoteResult.success) {
    return fail('股票不存在', 404)
  }

  const profile = (profileResult.data || {}) as { name?: string; industry?: string; industryDetail?: string }
  const quote = (quoteResult.data || {}) as Record<string, unknown>

  return ok(
    {
      code,
      name: profile.name || code,
      market: 'A股',
      industry: profile.industry || '',
      industry_detail: profile.industryDetail || '',
      total_mv: toNum(quote.total_mv),
      pe: toNum(quote.pe),
      pb: toNum(quote.pb),
      updated_at: new Date().toISOString()
    },
    '获取股票基础信息成功'
  )
}
