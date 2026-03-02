export interface AnalyzeParams {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
}

interface UsageInfo {
  input_tokens: number
  output_tokens: number
  thinking_tokens: number
  total_tokens: number
}

interface GroundingSource {
  title: string
  uri: string
}

export interface AnalyzeResult {
  content: string
  usage: UsageInfo
  thinking?: string
  sources: GroundingSource[]
  search_queries: string[]
}

const AI_CONFIG = {
  provider: 'google' as const,
  model: 'gemini-3.1-pro-preview',
  max_output_tokens: 65535,
  timeout_seconds: 120,
  api_version: 'v1beta',
  base_url: 'https://generativelanguage.googleapis.com',
  temperature: 1.0,
  thinking_level: 'high' as const,
  include_thoughts: false,
  enable_search: true
}

export const AI_MODEL_INFO = {
  provider: AI_CONFIG.provider,
  model: AI_CONFIG.model
} as const

function getApiKey(): string {
  const apiKey = (process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY 环境变量未设置')
  }
  return apiKey
}

function buildEndpoint(action: 'generateContent' | 'streamGenerateContent'): string {
  return `${AI_CONFIG.base_url}/${AI_CONFIG.api_version}/models/${encodeURIComponent(AI_CONFIG.model)}:${action}`
}

function toVertexRole(role: string): 'user' | 'model' {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'assistant' || normalized === 'model') return 'model'
  return 'user'
}

function buildContents(messages: Array<{ role: string; content: string }>) {
  return messages
    .map((message) => {
      const text = String(message.content || '')
      if (!text.trim()) return null
      return {
        role: toVertexRole(message.role),
        parts: [{ text }]
      }
    })
    .filter((item): item is { role: 'user' | 'model'; parts: Array<{ text: string }> } => Boolean(item))
}

function buildRequestBody(params: AnalyzeParams) {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: AI_CONFIG.max_output_tokens,
    temperature: AI_CONFIG.temperature,
    thinkingConfig: {
      thinkingLevel: AI_CONFIG.thinking_level,
      includeThoughts: AI_CONFIG.include_thoughts
    }
  }

  const body: Record<string, unknown> = {
    contents: buildContents(params.messages),
    generationConfig
  }

  if (params.systemPrompt.trim()) {
    body.systemInstruction = {
      parts: [{ text: params.systemPrompt }]
    }
  }

  if (AI_CONFIG.enable_search) {
    body.tools = [{ googleSearch: {} }]
  }

  return body
}

function extractTextAndThinking(candidate: unknown): { content: string; thinking: string } {
  const row = candidate as Record<string, unknown>
  const contentNode = row?.content as Record<string, unknown> | undefined
  const parts = Array.isArray(contentNode?.parts) ? (contentNode.parts as Array<Record<string, unknown>>) : []
  let content = ''
  let thinking = ''

  for (const part of parts) {
    const text = typeof part?.text === 'string' ? part.text : ''
    if (!text) continue
    if (part?.thought === true) {
      thinking += text
    } else {
      content += text
    }
  }

  return { content, thinking }
}

function extractUsage(data: unknown): UsageInfo {
  const row = data as Record<string, unknown>
  const usageMetadata = (row?.usageMetadata || row?.usage_metadata || {}) as Record<string, unknown>

  const inputTokens = Number(usageMetadata?.promptTokenCount || usageMetadata?.prompt_token_count || 0)
  const outputTokens = Number(usageMetadata?.candidatesTokenCount || usageMetadata?.candidates_token_count || 0)
  const thinkingTokens = Number(usageMetadata?.thoughtsTokenCount || usageMetadata?.thoughts_token_count || 0)
  const totalTokens = Number(usageMetadata?.totalTokenCount || usageMetadata?.total_token_count || inputTokens + outputTokens + thinkingTokens)

  return {
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    thinking_tokens: Number.isFinite(thinkingTokens) ? thinkingTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0
  }
}

function extractGrounding(candidate: unknown): { sources: GroundingSource[]; searchQueries: string[] } {
  const row = candidate as Record<string, unknown>
  const groundingMetadata = (row?.groundingMetadata || row?.grounding_metadata || {}) as Record<string, unknown>

  const queryRows = (groundingMetadata?.webSearchQueries || groundingMetadata?.web_search_queries || []) as unknown[]
  const searchQueries = queryRows
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)

  const chunks = (groundingMetadata?.groundingChunks || groundingMetadata?.grounding_chunks || []) as Array<Record<string, unknown>>
  const sourceMap = new Map<string, GroundingSource>()

  for (const chunk of chunks) {
    const web = (chunk?.web || {}) as Record<string, unknown>
    const uri = String(web?.uri || web?.url || '').trim()
    if (!uri) continue
    const title = String(web?.title || uri).trim() || uri
    if (!sourceMap.has(uri)) {
      sourceMap.set(uri, { title, uri })
    }
  }

  return {
    sources: Array.from(sourceMap.values()),
    searchQueries
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`
  try {
    const data = await response.json()
    const row = data as Record<string, unknown>
    const errorRow = (row?.error || {}) as Record<string, unknown>
    return String(errorRow?.message || fallback)
  } catch {
    return fallback
  }
}

export async function analyzeWithAI(params: AnalyzeParams): Promise<AnalyzeResult> {
  const apiKey = getApiKey()
  const endpoint = buildEndpoint('generateContent')
  const requestBody = buildRequestBody(params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout_seconds * 1000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const message = await parseErrorMessage(response)
      throw new Error(`AI调用失败: ${message}`)
    }

    const data = await response.json()
    const row = data as Record<string, unknown>
    const candidates = Array.isArray(row?.candidates) ? (row.candidates as unknown[]) : []
    const candidate = candidates[0]
    const parsed = extractTextAndThinking(candidate)
    const grounding = extractGrounding(candidate)

    return {
      content: parsed.content,
      usage: extractUsage(data),
      thinking: parsed.thinking || undefined,
      sources: grounding.sources,
      search_queries: grounding.searchQueries
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI调用超时')
    }
    throw error
  }
}

function processStreamLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('event:')) return null

  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!payload || payload === '[DONE]') return null

  try {
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeStreamChunks(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!payload) return []
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  }
  return [payload]
}

export async function streamAnalyzeWithAI(
  params: AnalyzeParams,
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void
): Promise<{ usage: UsageInfo }> {
  const apiKey = getApiKey()
  const endpoint = `${buildEndpoint('streamGenerateContent')}?alt=sse`
  const requestBody = buildRequestBody(params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout_seconds * 1000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const message = await parseErrorMessage(response)
      throw new Error(`AI调用失败: ${message}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let usage: UsageInfo = {
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      total_tokens: 0
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const payload = processStreamLine(line)
        if (!payload) continue

        for (const chunk of normalizeStreamChunks(payload)) {
          const candidates = Array.isArray(chunk?.candidates) ? (chunk.candidates as unknown[]) : []
          const candidate = candidates[0]
          const parsed = extractTextAndThinking(candidate)

          if (parsed.content) onChunk(parsed.content)
          if (parsed.thinking && onThinking) onThinking(parsed.thinking)

          if (chunk?.usageMetadata || chunk?.usage_metadata) {
            usage = extractUsage(chunk)
          }
        }
      }
    }

    if (buffer.trim()) {
      const payload = processStreamLine(buffer)
      for (const chunk of normalizeStreamChunks(payload)) {
        if (chunk?.usageMetadata || chunk?.usage_metadata) {
          usage = extractUsage(chunk)
        }
        const candidates = Array.isArray(chunk?.candidates) ? (chunk.candidates as unknown[]) : []
        const candidate = candidates[0]
        const parsed = extractTextAndThinking(candidate)
        if (parsed.content) onChunk(parsed.content)
        if (parsed.thinking && onThinking) onThinking(parsed.thinking)
      }
    }

    return { usage }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI调用超时')
    }
    throw error
  }
}

export async function isAIEnabled(): Promise<boolean> {
  try {
    const apiKey = (process.env.GOOGLE_API_KEY || '').trim()
    return apiKey.length > 10
  } catch {
    return false
  }
}
