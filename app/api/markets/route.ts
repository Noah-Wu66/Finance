import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return fail('未登录', 401)

  return ok(
    {
      markets: [
        {
          code: 'CN',
          name: 'A股',
          name_en: 'China A',
          currency: 'CNY',
          timezone: 'Asia/Shanghai',
          trading_hours: '09:30-11:30, 13:00-15:00'
        },
        {
          code: 'HK',
          name: '港股',
          name_en: 'Hong Kong',
          currency: 'HKD',
          timezone: 'Asia/Hong_Kong',
          trading_hours: '09:30-12:00, 13:00-16:00'
        },
        {
          code: 'US',
          name: '美股',
          name_en: 'United States',
          currency: 'USD',
          timezone: 'America/New_York',
          trading_hours: '09:30-16:00'
        }
      ]
    },
    '获取市场列表成功'
  )
}
