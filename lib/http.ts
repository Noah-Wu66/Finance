import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'

export function serializeForJson<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (value instanceof ObjectId) {
    return value.toHexString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as T
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(record)) {
      result[key] = serializeForJson(record[key])
    }
    return result as T
  }

  return value
}

export function ok<T>(data: T, message = 'ok') {
  return NextResponse.json({
    success: true,
    data: serializeForJson(data),
    message
  })
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      details: serializeForJson(details)
    },
    { status }
  )
}
