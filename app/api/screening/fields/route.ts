import { NextRequest } from 'next/server'

import { getRequestUser } from '@/lib/auth'
import { fail, ok } from '@/lib/http'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return fail('未登录', 401)
  }

  return ok(
    {
      fields: {
        close: {
          name: 'close',
          display_name: '最新价',
          field_type: 'number',
          data_type: 'float',
          description: '最近交易日收盘价',
          supported_operators: ['>', '>=', '<', '<=', 'between']
        },
        pct_chg: {
          name: 'pct_chg',
          display_name: '涨跌幅(%)',
          field_type: 'number',
          data_type: 'float',
          description: '最近交易日涨跌幅',
          supported_operators: ['>', '>=', '<', '<=', 'between']
        },
        pe: {
          name: 'pe',
          display_name: '市盈率PE',
          field_type: 'number',
          data_type: 'float',
          description: '最新可用市盈率',
          supported_operators: ['>', '>=', '<', '<=', 'between']
        },
        pb: {
          name: 'pb',
          display_name: '市净率PB',
          field_type: 'number',
          data_type: 'float',
          description: '最新可用市净率',
          supported_operators: ['>', '>=', '<', '<=', 'between']
        },
        industry: {
          name: 'industry',
          display_name: '行业',
          field_type: 'string',
          data_type: 'string',
          description: '股票所属行业',
          supported_operators: ['=', 'in']
        }
      },
      categories: {
        price: ['close', 'pct_chg'],
        valuation: ['pe', 'pb'],
        basic: ['industry']
      }
    },
    '获取筛选字段成功'
  )
}
