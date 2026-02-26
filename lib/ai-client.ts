interface AnalyzeParams {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  depth: 'deep'
}

interface AnalyzeResult {
  content: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
  thinking?: string
}

const AI_CONFIG = {
  provider: 'google' as const,
  model: 'google/gemini-3.1-pro-preview',
  max_output_tokens: 65535,
  timeout: 120,
  api_version: 'v1',
  base_url: 'https://zenmux.ai/api/vertex-ai'
}

export const AI_MODEL_INFO = {
  provider: AI_CONFIG.provider,
  model: AI_CONFIG.model
} as const

function getApiKey(): string {
  const apiKey = (process.env.ZENMUX_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('ZENMUX_API_KEY 环境变量未设置')
  }
  return apiKey
}

function getApiBase(): string {
  return AI_CONFIG.base_url
}

function getGenerationConfig() {
  return {
    maxOutputTokens: AI_CONFIG.max_output_tokens,
    thinkingConfig: {
      thinkingLevel: 'HIGH'
    }
  }
}

function resolveProviderAndModel(model: string): { provider: string; model: string } {
  const raw = String(model || '').trim()
  if (!raw) {
    return { provider: AI_CONFIG.provider, model: 'gemini-3.1-pro-preview' }
  }

  const parts = raw.split('/').filter(Boolean)
  if (parts.length >= 2) {
    return { provider: parts[0], model: parts.slice(1).join('/') }
  }

  return { provider: AI_CONFIG.provider, model: raw }
}

function buildEndpoint(action: 'generateContent' | 'streamGenerateContent'): string {
  const { provider, model } = resolveProviderAndModel(AI_CONFIG.model)
  const apiBase = getApiBase()
  return `${apiBase}/${AI_CONFIG.api_version}/publishers/${encodeURIComponent(provider)}/models/${encodeURIComponent(model)}:${action}`
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
    .filter(Boolean)
}

function buildRequestBody(params: AnalyzeParams) {
  const body: Record<string, unknown> = {
    contents: buildContents(params.messages),
    generationConfig: getGenerationConfig()
  }

  if (params.systemPrompt.trim()) {
    body.systemInstruction = {
      parts: [{ text: params.systemPrompt }]
    }
  }

  return body
}

function extractTextAndThinking(candidate: any): { content: string; thinking: string } {
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
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

function extractUsage(data: any) {
  return {
    input_tokens: Number(data?.usageMetadata?.promptTokenCount || 0),
    output_tokens: Number(data?.usageMetadata?.candidatesTokenCount || 0)
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`
  try {
    const data = await response.json()
    return String(data?.error?.message || fallback)
  } catch {
    return fallback
  }
}

export async function analyzeWithAI(params: AnalyzeParams): Promise<AnalyzeResult> {
  const apiKey = getApiKey()
  const endpoint = buildEndpoint('generateContent')
  const requestBody = buildRequestBody(params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout * 1000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`
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
    const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null
    const parsed = extractTextAndThinking(candidate)

    return {
      content: parsed.content,
      usage: extractUsage(data),
      thinking: parsed.thinking || undefined
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI调用超时')
    }
    throw error
  }
}

function processStreamLine(line: string): any | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('event:')) return null

  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!payload || payload === '[DONE]') return null

  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function normalizeStreamChunks(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') return [payload]
  return []
}

export async function streamAnalyzeWithAI(
  params: AnalyzeParams,
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void
): Promise<{ usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = getApiKey()
  const endpoint = buildEndpoint('streamGenerateContent')
  const requestBody = buildRequestBody(params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout * 1000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`
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
    let usage = { input_tokens: 0, output_tokens: 0 }

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
          const candidate = Array.isArray(chunk?.candidates) ? chunk.candidates[0] : null
          const parsed = extractTextAndThinking(candidate)

          if (parsed.content) onChunk(parsed.content)
          if (parsed.thinking && onThinking) onThinking(parsed.thinking)

          if (chunk?.usageMetadata) {
            usage = extractUsage(chunk)
          }
        }
      }
    }

    if (buffer.trim()) {
      const payload = processStreamLine(buffer)
      for (const chunk of normalizeStreamChunks(payload)) {
        if (chunk?.usageMetadata) {
          usage = extractUsage(chunk)
        }
        const candidate = Array.isArray(chunk?.candidates) ? chunk.candidates[0] : null
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
    const apiKey = (process.env.ZENMUX_API_KEY || '').trim()
    return apiKey.length > 10
  } catch {
    return false
  }
}
