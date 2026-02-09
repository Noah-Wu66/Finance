import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'
import { getFundamentalsByCode, getStockBasicByCode } from '@/lib/stock-data'

interface Params {
  params: { symbol: string }
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  const symbol = params.symbol.toUpperCase()
  const [basic, funda] = await Promise.all([getStockBasicByCode(symbol), getFundamentalsByCode(symbol)])
  if (!basic && !funda) return fail('基本面数据不存在', 404)

  return ok(
    {
      symbol,
      code: symbol,
      full_symbol: symbol,
      name: basic?.name || symbol,
      industry: basic?.industry,
      market: basic?.market,
      sector: basic?.sector,
      pe: funda?.pe,
      pb: funda?.pb,
      ps: funda?.ps,
      pe_ttm: funda?.pe_ttm,
      pb_mrq: funda?.pb_mrq,
      ps_ttm: funda?.ps_ttm,
      roe: funda?.roe,
      debt_ratio: funda?.debt_ratio,
      total_mv: funda?.total_mv || basic?.total_mv,
      circ_mv: funda?.circ_mv,
      turnover_rate: funda?.turnover_rate,
      volume_ratio: funda?.volume_ratio,
      pe_is_realtime: false,
      pe_source: 'financial_data',
      pe_updated_at: funda?.updated_at,
      updated_at: funda?.updated_at || basic?.updated_at || new Date().toISOString()
    },
    '获取基本面成功'
  )
}
