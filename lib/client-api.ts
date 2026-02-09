'use client'

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message: string
  details?: unknown
}

async function parseJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    credentials: 'include',
    cache: 'no-store'
  })

  const data = (await parseJson(response)) as ApiEnvelope<T>

  if (!response.ok || !data.success) {
    throw new Error(data.message || '请求失败')
  }

  return data
}
