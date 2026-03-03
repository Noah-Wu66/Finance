import endpointSeeds from '@/lib/tushare-11000-endpoints.json'

export interface Tushare11000Endpoint {
  key: string
  order: number
  interface_name: string
  api_name: string
  api_name_raw: string
  doc_id?: number
  category: string
  description: string
  params: string[]
  return_fields: string[]
  params_text: string
  return_fields_text: string
}

interface Tushare11000EndpointSeed {
  order?: number
  interface_name?: string
  api_name?: string
  api_name_raw?: string
  doc_id?: number
  category?: string
  description?: string
  params?: string[]
  return_fields?: string[]
}

function normalizeStrings(values: string[]): string[] {
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim().toLowerCase()
    if (!normalized) continue
    result.push(normalized)
  }
  return result
}

const API_NAME_ALIASES: Record<string, string> = {
  balance_sheet: 'balancesheet',
  stock_namechange: 'namechange',
  stock_new: 'new_share',
  daily_adj: 'pro_bar',
  st_limit_price: 'stk_limit',
  suspend: 'suspend_d',
  fina_forecast: 'forecast',
  fina_report_date: 'disclosure_date',
  stock_pledge_stat: 'pledge_stat',
  stock_pledge_detail: 'pledge_detail',
  stock_repurchase: 'repurchase',
  stock_restricted: 'share_float',
  stock_block_trade: 'block_trade',
  stock_holdernum: 'stk_holdernumber',
  stock_holder_trade: 'stk_holdertrade',
  stock_chip: 'cyq_perf',
  stock_shareholdernum: 'cyq_chips',
  stock_factor: 'stk_factor_pro',
  stock_hold_stats: 'ccass_hold',
  stock_hold_detail: 'ccass_hold_detail',
  hsgt_hold_detail: 'hk_hold',
  stock_auction: 'stk_auction',
  stock_auction_end: 'stk_auction_c',
  stock_magical: 'stk_nineturn',
  stock_ah_price: 'stk_ah_comparison',
  stock_research: 'stk_surv',
  stock_gold: 'broker_recommend',
  toplist: 'top_list',
  st_limit_list: 'limit_list_d',
  limit_ladder: 'limit_step',
  limit_industry_stat: 'limit_cpt_list',
  concept: 'ths_index',
  concept_daily: 'ths_daily',
  concept_detail: 'ths_member',
  concept_dc: 'dc_index',
  concept_detail_dc: 'dc_member',
  concept_daily_dc: 'dc_daily',
  money_capital: 'hm_list',
  money_trade: 'hm_detail',
  kpl_toplist: 'kpl_list',
  kpl_concept: 'kpl_concept_cons',
  tdx_block_info: 'tdx_index',
  tdx_block_detail: 'tdx_member',
  tdx_block_daily: 'tdx_daily',
  etf_adj_factor: 'fund_adj',
  etf_share: 'etf_share_size',
  etf_daily: 'fund_daily',
  hkgt_top10: 'ggt_top10',
  hkgt_daily: 'ggt_daily',
  hkgt_monthly: 'ggt_monthly',
  option_basic: 'opt_basic',
  option_daily: 'opt_daily',
  option_minute: 'opt_mins',
  gdp: 'cn_gdp',
  cpi: 'cn_cpi',
  ppi: 'cn_ppi',
  money_supply: 'cn_m',
  financing: 'sf_month',
  shibor_detail: 'shibor_quote',
  lpr: 'shibor_lpr',
  wz_rate: 'wz_index',
  gz_rate: 'gz_index',
  pmi: 'cn_pmi',
  bond_treasury_short: 'us_tbr',
  bond_treasury_long: 'us_tltr',
  bond_china_yield: 'us_tycr',
  margin_target: 'margin_secs',
  rzye_target: 'slb_len',
  moneyflow_industry_ths: 'moneyflow_ind_ths',
  moneyflow_hy_ths: 'moneyflow_ind_ths',
  moneyflow_concept_dc: 'moneyflow_ind_dc',
  moneyflow_market_dc: 'moneyflow_mkt_dc',
}

export function normalizeTushareApiName(value: unknown): string {
  const text = String(value || '').trim().toLowerCase()
  const match = text.match(/[a-z][a-z0-9_]*/)
  const raw = match?.[0] || ''
  return API_NAME_ALIASES[raw] || raw
}

function toInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const RAW_SEEDS: Tushare11000EndpointSeed[] = Array.isArray(endpointSeeds)
  ? (endpointSeeds as Tushare11000EndpointSeed[])
  : []

const HARD_CODED_ENDPOINTS: Tushare11000Endpoint[] = (() => {
  const list: Tushare11000Endpoint[] = []

  RAW_SEEDS.forEach((row, index) => {
    const apiNameRaw = String(row.api_name_raw ?? row.api_name ?? '').trim()
    const apiName = normalizeTushareApiName(apiNameRaw)
    if (!apiName) return

    const docId = toInteger(row.doc_id)
    const params = Array.isArray(row.params)
      ? normalizeStrings(row.params.map((item) => String(item || '')))
      : []
    const returnFields = Array.isArray(row.return_fields)
      ? normalizeStrings(row.return_fields.map((item) => String(item || '')))
      : []
    const order = toInteger(row.order) ?? index + 1

    list.push({
      key: `${docId ?? 'na'}-${apiName}-${index + 1}`,
      order,
      interface_name: String(row.interface_name || apiName),
      api_name: apiName,
      api_name_raw: apiNameRaw || apiName,
      doc_id: docId,
      category: String(row.category || '未分类'),
      description: String(row.description || ''),
      params,
      return_fields: returnFields,
      params_text: params.join('、'),
      return_fields_text: returnFields.join('、')
    })
  })

  list.sort((a, b) => a.order - b.order)
  return list
})()

async function readHardCodedEndpoints(): Promise<Tushare11000Endpoint[]> {
  return HARD_CODED_ENDPOINTS
}

export async function getTushare11000Endpoints(): Promise<Tushare11000Endpoint[]> {
  return readHardCodedEndpoints()
}

export async function findTushare11000Endpoint(input: {
  apiName?: string
  docId?: number
}): Promise<Tushare11000Endpoint | null> {
  const endpoints = await getTushare11000Endpoints()

  if (input.docId !== undefined) {
    const foundByDocId = endpoints.find((item) => item.doc_id === input.docId)
    if (foundByDocId) return foundByDocId
  }

  if (input.apiName) {
    const normalizedApiName = normalizeTushareApiName(input.apiName)
    const foundByApiName = endpoints.find((item) => item.api_name === normalizedApiName)
    if (foundByApiName) return foundByApiName
  }

  return null
}

export async function findTushare11000EndpointsByApiName(apiName: string): Promise<Tushare11000Endpoint[]> {
  const normalizedApiName = normalizeTushareApiName(apiName)
  if (!normalizedApiName) return []
  const endpoints = await getTushare11000Endpoints()
  return endpoints.filter((item) => item.api_name === normalizedApiName)
}

export async function getTushare11000SupportedApiNames(): Promise<string[]> {
  const endpoints = await getTushare11000Endpoints()
  return Array.from(new Set(endpoints.map((item) => item.api_name))).sort((a, b) => a.localeCompare(b))
}

export async function isTushare11000SupportedApi(apiName: string): Promise<boolean> {
  const normalizedApiName = normalizeTushareApiName(apiName)
  if (!normalizedApiName) return false
  const endpoints = await getTushare11000Endpoints()
  return endpoints.some((item) => item.api_name === normalizedApiName)
}
