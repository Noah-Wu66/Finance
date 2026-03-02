import { promises as fs } from 'node:fs'
import path from 'node:path'

const DOC_FILE = 'tushare_11000_api_docs.md'
const STRUCTURED_START_MARKER = '<!-- TUSHARE_11000_STRUCTURED_JSON_START -->'
const STRUCTURED_END_MARKER = '<!-- TUSHARE_11000_STRUCTURED_JSON_END -->'

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

interface EndpointCache {
  mtimeMs: number
  endpoints: Tushare11000Endpoint[]
}

let endpointCache: EndpointCache | null = null

function normalizeStrings(values: string[]): string[] {
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim().toLowerCase()
    if (!normalized) continue
    result.push(normalized)
  }
  return result
}

function extractFirstValue(block: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = block.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function parseTokenList(raw: string): string[] {
  if (!raw) return []
  const stripped = raw
    .replace(/（[^）]*）/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[：:；;。]/g, ' ')
    .replace(/\*\*/g, ' ')

  const matches = stripped.match(/[A-Za-z][A-Za-z0-9_]*/g) || []
  return normalizeStrings(matches)
}

function parseParamTable(block: string): string[] {
  const rows = block.split(/\r?\n/)
  const tokens: string[] = []
  for (const row of rows) {
    const line = row.trim()
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const firstCell = cells[1] || ''
    if (!firstCell || firstCell === '参数名称' || /^-+$/.test(firstCell)) continue
    const match = firstCell.match(/[A-Za-z][A-Za-z0-9_]*/)
    if (match?.[0]) tokens.push(match[0])
  }
  return normalizeStrings(tokens)
}

export function normalizeTushareApiName(value: unknown): string {
  const text = String(value || '').trim().toLowerCase()
  const match = text.match(/[a-z][a-z0-9_]*/)
  return match?.[0] || ''
}

function parseDocId(raw: string): number | undefined {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return undefined
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseEndpointBlock(block: string, index: number): Tushare11000Endpoint | null {
  const interfaceNameRaw = extractFirstValue(block, [/\*\*接口名称\*\*：([^\n]+)/])
  const docIdRaw = extractFirstValue(block, [/\*\*文档ID\*\*：([^\n]+)/])
  const categoryRaw = extractFirstValue(block, [/\*\*所属分类\*\*：([^\n]+)/])
  const descriptionRaw = extractFirstValue(block, [/\*\*接口说明\*\*：([^\n]+)/])

  let apiRaw = extractFirstValue(block, [
    /\*\*API接口名\*\*：([^\n]+)/,
    /API接口名\*\*：([^\n]+)/
  ])

  if (!apiRaw && block.includes('concept_daily_dc')) {
    apiRaw = 'concept_daily_dc'
  }

  if (!apiRaw) {
    const fallback = block.match(/^\*\*([a-z][a-z0-9_]+)\s*$/im)
    if (fallback?.[1]) apiRaw = fallback[1]
  }

  let apiName = normalizeTushareApiName(apiRaw)
  if (!apiName) {
    const fallback = block.match(/^\*\*([a-z][a-z0-9_]+)\s*$/im)
    if (fallback?.[1]) {
      apiRaw = fallback[1]
      apiName = normalizeTushareApiName(apiRaw)
    }
  }

  if (!apiName && block.includes('concept_daily_dc')) {
    apiRaw = 'concept_daily_dc'
    apiName = 'concept_daily_dc'
  }

  if (!apiName) return null

  let paramsRaw = extractFirstValue(block, [/\*\*输入参数\*\*：([^\n]*)/])
  if (!paramsRaw) {
    paramsRaw = extractFirstValue(block, [/\*\*输入参数([^\n]*)/])
  }

  let returnFieldsRaw = extractFirstValue(block, [
    /\*\*返回字段\*\*：([^\n]*)/,
    /返回字段\*\*：([^\n]*)/
  ])

  const paramsFromLine = parseTokenList(paramsRaw)
  const paramsFromTable = paramsFromLine.length > 0 ? [] : parseParamTable(block)
  const params = [...paramsFromLine, ...paramsFromTable]
  const returnFields = parseTokenList(returnFieldsRaw)

  const docId = parseDocId(docIdRaw)
  const interfaceName = interfaceNameRaw
    ? interfaceNameRaw.replace(/API接口名.*$/g, '').trim()
    : apiName

  if (!returnFieldsRaw) {
    returnFieldsRaw = returnFields.join('、')
  }

  return {
    key: `${docId ?? 'na'}-${apiName}-${index}`,
    order: index,
    interface_name: interfaceName,
    api_name: apiName,
    api_name_raw: apiRaw,
    doc_id: docId,
    category: categoryRaw || '未分类',
    description: descriptionRaw,
    params,
    return_fields: returnFields,
    params_text: paramsRaw,
    return_fields_text: returnFieldsRaw
  }
}

function parseStructuredJsonSection(content: string): Tushare11000Endpoint[] | null {
  const start = content.indexOf(STRUCTURED_START_MARKER)
  const end = content.indexOf(STRUCTURED_END_MARKER)
  if (start < 0 || end < 0 || end <= start) return null

  const section = content.slice(start, end)
  const jsonMatch = section.match(/```json\s*([\s\S]*?)\s*```/)
  if (!jsonMatch?.[1]) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[1])
  } catch {
    return null
  }

  const payload = parsed as { items?: unknown[] }
  if (!Array.isArray(payload.items) || payload.items.length === 0) return null

  const endpoints: Tushare11000Endpoint[] = []
  for (let i = 0; i < payload.items.length; i += 1) {
    const row = payload.items[i] as Record<string, unknown>
    const apiNameRaw = String(row.api_name_raw ?? row.api_name ?? '').trim()
    const apiName = normalizeTushareApiName(apiNameRaw)
    if (!apiName) continue

    const docId = toInteger(row.doc_id)
    const params = Array.isArray(row.params)
      ? normalizeStrings(row.params.map((item) => String(item || '')))
      : []
    const returnFields = Array.isArray(row.return_fields)
      ? normalizeStrings(row.return_fields.map((item) => String(item || '')))
      : []

    endpoints.push({
      key: `${docId ?? 'na'}-${apiName}-${i + 1}`,
      order: toInteger(row.order) ?? i + 1,
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
  }

  return endpoints.length > 0 ? endpoints : null
}

async function readDocFile() {
  const filePath = path.join(process.cwd(), DOC_FILE)
  const stat = await fs.stat(filePath)

  if (endpointCache && endpointCache.mtimeMs === stat.mtimeMs) {
    return endpointCache.endpoints
  }

  const content = await fs.readFile(filePath, 'utf8')
  const structuredEndpoints = parseStructuredJsonSection(content)

  const endpoints: Tushare11000Endpoint[] = structuredEndpoints ?? []
  if (endpoints.length === 0) {
    const blocks = content.split(/\r?\n---+\r?\n/)
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i]
      if (!block.includes('接口名称') || !block.includes('文档ID')) continue
      const parsed = parseEndpointBlock(block, i)
      if (parsed) endpoints.push(parsed)
    }
  }

  endpointCache = {
    mtimeMs: stat.mtimeMs,
    endpoints
  }

  return endpoints
}

export async function getTushare11000Endpoints(): Promise<Tushare11000Endpoint[]> {
  return readDocFile()
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
