interface AnalyzeParams {
  systemPrompt: string
  messages: Array<{role: string, content: string}>
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

// 硬编码配置 - Claude Opus 4.6 统一配置
const AI_CONFIG = {
  provider: 'anthropic' as const,
  model: 'claude-opus-4-6',
  max_tokens: 64000,        // 统一使用64000
  temperature: 0.7,
  timeout: 120,
  thinking_enabled: true,   // 开启自适应思考
  effort: 'max' as const,   // 最高质量
  enable_tools: false,
  // 定价：美元/百万token
  pricing: {
    input: 15,   // $15 / M input tokens
    output: 75,  // $75 / M output tokens
  }
}

// 导出模型信息供外部使用（如费用计算）
export const AI_MODEL_INFO = {
  provider: AI_CONFIG.provider,
  model: AI_CONFIG.model,
  pricing: AI_CONFIG.pricing,
} as const

// 从环境变量获取API Key
function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 环境变量未设置')
  }
  return apiKey
}

// 从环境变量获取API Base URL
function getApiBase(): string {
  return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
}

export async function analyzeWithAI(params: AnalyzeParams): Promise<AnalyzeResult> {
  const apiKey = getApiKey()
  const apiBase = getApiBase()
  
  const requestBody: Record<string, unknown> = {
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.max_tokens,
    temperature: AI_CONFIG.temperature,
    system: params.systemPrompt,
    messages: params.messages,
    effort: AI_CONFIG.effort,
    thinking: { type: 'adaptive' }  // 开启自适应思考
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout * 1000)

  try {
    const response = await fetch(`${apiBase}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: '未知错误' } }))
      throw new Error(`AI调用失败: ${errorData.error?.message || `HTTP ${response.status}`}`)
    }

    const data = await response.json()
    
    // 提取文本内容和思考过程
    let content = ''
    let thinking = ''
    
    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text
      } else if (block.type === 'thinking') {
        thinking += block.thinking
      }
    }

    return {
      content,
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      },
      thinking: thinking || undefined
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI调用超时')
    }
    throw error
  }
}

export async function streamAnalyzeWithAI(
  params: AnalyzeParams,
  onChunk: (chunk: string) => void,
  onThinking?: (thinking: string) => void
): Promise<{ usage: { input_tokens: number, output_tokens: number } }> {
  const apiKey = getApiKey()
  const apiBase = getApiBase()
  
  const requestBody: Record<string, unknown> = {
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.max_tokens,
    temperature: AI_CONFIG.temperature,
    system: params.systemPrompt,
    messages: params.messages,
    effort: AI_CONFIG.effort,
    thinking: { type: 'adaptive' },
    stream: true
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout * 1000)

  try {
    const response = await fetch(`${apiBase}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: '未知错误' } }))
      throw new Error(`AI调用失败: ${errorData.error?.message || `HTTP ${response.status}`}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data)
            
            // 处理内容块
            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                onChunk(event.delta.text)
              } else if (event.delta?.type === 'thinking_delta' && onThinking) {
                onThinking(event.delta.thinking)
              }
            }
            
            // 处理usage信息
            if (event.type === 'message_delta' && event.usage) {
              inputTokens = event.usage.input_tokens || inputTokens
              outputTokens = event.usage.output_tokens || outputTokens
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    return {
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      }
    }
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
    const apiKey = process.env.ANTHROPIC_API_KEY
    return !!apiKey && apiKey.startsWith('sk-ant-')
  } catch {
    return false
  }
}
