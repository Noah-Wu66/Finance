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

export function normalizeTushareApiName(value: unknown): string {
  const text = String(value || '').trim().toLowerCase()
  const match = text.match(/[a-z][a-z0-9_]*/)
  return match?.[0] || ''
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
