import { compare, hash } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import { getDb } from '@/lib/db'

export const AUTH_COOKIE = 'ta_token'
export const REFRESH_COOKIE = 'ta_refresh_token'
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type TokenKind = 'access' | 'refresh'

export interface SessionUser {
  userId: string
  email: string
  isAdmin: boolean
  nickname?: string
}

export interface UserPublicProfile {
  id: string
  email: string
  nickname?: string
  is_active: boolean
  is_verified: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
  last_login?: string
  preferences: Record<string, unknown>
  daily_quota: number
  concurrent_limit: number
  total_analyses: number
  successful_analyses: number
  failed_analyses: number
}

interface JwtPayload extends SessionUser {
  token_kind: TokenKind
  iat: number
  exp: number
}

declare global {
  var __usersIndexesReady__: Promise<void> | undefined
}

const jwtSecretText = (process.env.JWT_SECRET || '').trim()
if (!jwtSecretText) {
  throw new Error('JWT_SECRET 环境变量未设置，服务拒绝启动')
}
const jwtSecretValue = new TextEncoder().encode(jwtSecretText)

function jwtSecret() {
  return jwtSecretValue
}

const defaultPreferences = {
  default_market: 'A股',
  default_analysts: ['市场分析师', '基本面分析师'],
  auto_refresh: true,
  refresh_interval: 3,
  ui_theme: 'light',
  sidebar_width: 240,
  language: 'zh-CN',
  notifications_enabled: true,
  email_notifications: false,
  desktop_notifications: true,
  analysis_complete_notification: true,
  system_maintenance_notification: true
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

async function ensureUsersCollectionIndexes() {
  if (!global.__usersIndexesReady__) {
    global.__usersIndexesReady__ = (async () => {
      const db = await getDb()
      const users = db.collection('users')

      await users.updateMany(
        { email: { $type: 'string' } },
        [
          {
            $set: {
              email: { $toLower: '$email' },
              email_normalized: { $toLower: '$email' }
            }
          }
        ]
      )

      await users.createIndex(
        { email_normalized: 1 },
        { unique: true, name: 'uniq_users_email_normalized' }
      )
    })()
  }

  return global.__usersIndexesReady__
}

function normalizeDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

export function toPublicUserProfile(user: Record<string, unknown>): UserPublicProfile {
  const id = (user._id as ObjectId).toHexString()
  return {
    id,
    email: String(user.email || ''),
    nickname: user.nickname ? String(user.nickname) : undefined,
    is_active: user.is_active !== false,
    is_verified: Boolean(user.is_verified),
    is_admin: Boolean(user.is_admin),
    created_at: normalizeDateString(user.created_at),
    updated_at: normalizeDateString(user.updated_at),
    last_login: user.last_login ? normalizeDateString(user.last_login) : undefined,
    preferences: {
      ...defaultPreferences,
      ...(typeof user.preferences === 'object' && user.preferences ? (user.preferences as Record<string, unknown>) : {})
    },
    daily_quota: Number(user.daily_quota || 1000),
    concurrent_limit: Number(user.concurrent_limit || 3),
    total_analyses: Number(user.total_analyses || 0),
    successful_analyses: Number(user.successful_analyses || 0),
    failed_analyses: Number(user.failed_analyses || 0)
  }
}

export async function getUserById(userId: string): Promise<Record<string, unknown> | null> {
  if (!ObjectId.isValid(userId)) return null
  const db = await getDb()
  return db.collection('users').findOne({ _id: new ObjectId(userId) }) as Promise<Record<string, unknown> | null>
}

export async function isEmailTaken(email: string, excludeUserId?: string) {
  await ensureUsersCollectionIndexes()

  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const db = await getDb()
  const users = db.collection('users')

  const query: Record<string, unknown> = { email_normalized: normalized }
  if (excludeUserId && ObjectId.isValid(excludeUserId)) {
    query._id = { $ne: new ObjectId(excludeUserId) }
  }

  const exists = await users.findOne(query, { projection: { _id: 1 } })
  return Boolean(exists)
}

export async function createUserAccount(input: { email: string; password: string; nickname?: string; isAdmin?: boolean }) {
  await ensureUsersCollectionIndexes()

  const normalizedEmail = normalizeEmail(input.email)
  if (!normalizedEmail) {
    throw new Error('邮箱不能为空')
  }

  const db = await getDb()
  const users = db.collection('users')

  const now = new Date()
  const passwordHash = await hashPassword(input.password)

  const result = await users.insertOne({
    email: normalizedEmail,
    email_normalized: normalizedEmail,
    nickname: input.nickname,
    hashed_password: passwordHash,
    is_active: true,
    is_verified: false,
    is_admin: input.isAdmin === true,
    created_at: now,
    updated_at: now,
    preferences: defaultPreferences,
    daily_quota: 1000,
    concurrent_limit: 3,
    total_analyses: 0,
    successful_analyses: 0,
    failed_analyses: 0,
    favorite_stocks: []
  })

  const user = await users.findOne({ _id: result.insertedId })
  return user as Record<string, unknown> | null
}

export async function updateUserProfile(userId: string, updates: {
  email?: string
  nickname?: string
  preferences?: Record<string, unknown>
  daily_quota?: number
  concurrent_limit?: number
}) {
  if (!ObjectId.isValid(userId)) return null

  await ensureUsersCollectionIndexes()

  const db = await getDb()
  const users = db.collection('users')

  const patch: Record<string, unknown> = {
    updated_at: new Date()
  }

  if (updates.email !== undefined) {
    const normalizedEmail = normalizeEmail(updates.email)
    if (!normalizedEmail) {
      throw new Error('邮箱不能为空')
    }
    const exists = await isEmailTaken(normalizedEmail, userId)
    if (exists) {
      throw new Error('邮箱已存在')
    }
    patch.email = normalizedEmail
    patch.email_normalized = normalizedEmail
  }
  if (updates.nickname !== undefined) patch.nickname = updates.nickname
  if (updates.preferences !== undefined) patch.preferences = updates.preferences
  if (updates.daily_quota !== undefined) patch.daily_quota = updates.daily_quota
  if (updates.concurrent_limit !== undefined) patch.concurrent_limit = updates.concurrent_limit

  await users.updateOne({ _id: new ObjectId(userId) }, { $set: patch })
  return users.findOne({ _id: new ObjectId(userId) }) as Promise<Record<string, unknown> | null>
}

export async function updateUserPassword(userId: string, newPassword: string) {
  if (!ObjectId.isValid(userId)) return false
  const db = await getDb()
  const users = db.collection('users')
  const passwordHash = await hashPassword(newPassword)
  const res = await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        hashed_password: passwordHash,
        updated_at: new Date()
      }
    }
  )
  return res.matchedCount > 0
}

async function signUserToken(user: SessionUser, tokenKind: TokenKind, maxAgeSeconds: number) {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    isAdmin: user.isAdmin,
    nickname: user.nickname,
    token_kind: tokenKind
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(jwtSecret())
}

export async function signAccessToken(user: SessionUser) {
  return signUserToken(user, 'access', ACCESS_TOKEN_MAX_AGE_SECONDS)
}

export async function signRefreshToken(user: SessionUser) {
  return signUserToken(user, 'refresh', REFRESH_TOKEN_MAX_AGE_SECONDS)
}

export async function verifyUserToken(token: string, expectedTokenKind: TokenKind = 'access'): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret())
    const data = payload as unknown as JwtPayload
    if (data.token_kind !== expectedTokenKind) {
      return null
    }

    return {
      userId: data.userId,
      email: data.email,
      isAdmin: Boolean(data.isAdmin),
      nickname: data.nickname
    }
  } catch {
    return null
  }
}

function tokenFromRequest(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (header && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7)
  }
  return request.cookies.get(AUTH_COOKIE)?.value || null
}

export function tokenFromRefreshRequest(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE)?.value || null
}

export async function getRequestUser(request: NextRequest): Promise<SessionUser | null> {
  const token = tokenFromRequest(request)
  if (!token) return null
  return verifyUserToken(token, 'access')
}

export async function getRefreshRequestUser(request: NextRequest): Promise<SessionUser | null> {
  const token = tokenFromRefreshRequest(request)
  if (!token) return null
  return verifyUserToken(token, 'refresh')
}

export async function verifyRefreshToken(token: string): Promise<SessionUser | null> {
  return verifyUserToken(token, 'refresh')
}

export function applyAccessCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS
  })
}

export function applyRefreshCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS
  })
}

export function applyAuthCookies(response: NextResponse, tokens: { accessToken: string; refreshToken: string }) {
  applyAccessCookie(response, tokens.accessToken)
  applyRefreshCookie(response, tokens.refreshToken)
}

export function applyAuthCookie(response: NextResponse, token: string) {
  applyAccessCookie(response, token)
}

export function applyRefreshAuthCookie(response: NextResponse, token: string) {
  applyRefreshCookie(response, token)
}

export function clearAccessCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
}

export function clearAuthCookie(response: NextResponse) {
  clearAccessCookie(response)
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
}

export async function verifyUserPassword(email: string, password: string): Promise<SessionUser | null> {
  await ensureUsersCollectionIndexes()

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const db = await getDb()
  const users = db.collection('users')

  const user = await users.findOne({ email_normalized: normalizedEmail })
  if (!user || user.is_active === false) {
    return null
  }

  const hashedPassword =
    (user.hashed_password as string | undefined) ||
    (user.password_hash as string | undefined) ||
    (user.password as string | undefined) ||
    ''

  let matched = false
  if (hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2y$')) {
    matched = await compare(password, hashedPassword)
  } else {
    matched = password === hashedPassword
  }

  if (!matched) {
    return null
  }

  await users.updateOne(
    { _id: user._id as ObjectId },
    {
      $set: {
        last_login: new Date(),
        updated_at: new Date()
      }
    }
  )

  return {
    userId: (user._id as ObjectId).toHexString(),
    email: user.email as string,
    isAdmin: Boolean(user.is_admin),
    nickname: (user.nickname as string | undefined) || undefined
  }
}

export async function hashPassword(password: string) {
  return hash(password, 10)
}
