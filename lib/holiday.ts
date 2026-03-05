/**
 * 中国节假日和交易日工具
 * 使用 https://timor.tech/api/holiday/ 免费API
 */

interface HolidayInfo {
  code: number
  type: {
    type: 0 | 1 | 2 | 3 // 0=工作日, 1=周末, 2=节日, 3=调休
    name: string
    week: 1 | 2 | 3 | 4 | 5 | 6 | 7
  }
  holiday: {
    holiday: boolean
    name: string
    wage: number
    after?: boolean
    target?: string
  } | null
}

const HOLIDAY_API_BASE = 'https://timor.tech/api/holiday'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24小时缓存

interface CacheEntry {
  data: HolidayInfo
  timestamp: number
}

// 内存缓存
const cache = new Map<string, CacheEntry>()

/**
 * 获取指定日期的节假日信息
 * @param date 日期字符串，格式 'YYYY-MM-DD' 或 'YYYYMMDD'
 */
async function getHolidayInfo(date: string): Promise<HolidayInfo | null> {
  const normalized = normalizeDate(date)
  if (!normalized) return null

  // 检查缓存
  const cached = cache.get(normalized)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  try {
    const response = await fetch(`${HOLIDAY_API_BASE}/info/${normalized}`, {
      next: { revalidate: 86400 } // 24小时缓存
    })

    if (!response.ok) {
      console.warn(`[holiday] API返回错误: ${response.status}`)
      return null
    }

    const data = await response.json() as HolidayInfo

    if (data.code === 0) {
      cache.set(normalized, { data, timestamp: Date.now() })
      return data
    }

    return null
  } catch (error) {
    console.error('[holiday] 获取节假日信息失败:', error)
    return null
  }
}

/**
 * 判断指定日期是否是交易日
 * 交易日 = 工作日 或 调休日（需要上班的周末）
 * @param date 日期字符串，格式 'YYYY-MM-DD' 或 'YYYYMMDD'
 */
export async function isTradingDay(date: string): Promise<boolean> {
  const info = await getHolidayInfo(date)
  if (!info) {
    // API失败时，简单判断：周一到周五为交易日
    const d = parseDate(date)
    if (!d) return false
    const day = d.getDay()
    return day >= 1 && day <= 5
  }

  // type: 0=工作日, 1=周末, 2=节日, 3=调休
  // 交易日 = 工作日(0) 或 调休(3)
  return info.type.type === 0 || info.type.type === 3
}

/**
 * 获取最近的交易日（包括今天）
 * @param maxDaysBack 最多往前查找多少天，默认10天
 */
export async function getLatestTradingDay(maxDaysBack = 10): Promise<string | null> {
  const today = new Date()

  for (let i = 0; i <= maxDaysBack; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = formatDate(date)

    if (await isTradingDay(dateStr)) {
      return dateStr.replace(/-/g, '') // 返回 YYYYMMDD 格式
    }
  }

  return null
}

/**
 * 获取下一个交易日
 * @param fromDate 起始日期，格式 'YYYY-MM-DD' 或 'YYYYMMDD'，默认今天
 * @param maxDaysForward 最多往后查找多少天，默认10天
 */
export async function getNextTradingDay(fromDate?: string, maxDaysForward = 10): Promise<string | null> {
  const startDate = fromDate ? parseDate(fromDate) : new Date()
  if (!startDate) return null

  for (let i = 1; i <= maxDaysForward; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = formatDate(date)

    if (await isTradingDay(dateStr)) {
      return dateStr.replace(/-/g, '') // 返回 YYYYMMDD 格式
    }
  }

  return null
}

/**
 * 获取指定日期往前N个交易日的日期
 * @param fromDate 起始日期，格式 'YYYY-MM-DD' 或 'YYYYMMDD'
 * @param count 往前多少个交易日
 */
export async function getTradingDaysAgo(fromDate: string, count: number): Promise<string | null> {
  const startDate = parseDate(fromDate)
  if (!startDate || count < 0) return null

  let tradingDaysFound = 0
  let currentDate = new Date(startDate)

  // 最多查找 count * 2 天（考虑周末和节假日）
  const maxDays = count * 2 + 30
  for (let i = 0; i < maxDays; i++) {
    currentDate.setDate(currentDate.getDate() - 1)
    const dateStr = formatDate(currentDate)

    if (await isTradingDay(dateStr)) {
      tradingDaysFound++
      if (tradingDaysFound === count) {
        return dateStr.replace(/-/g, '') // 返回 YYYYMMDD 格式
      }
    }
  }

  return null
}

// ========== 辅助函数 ==========

/**
 * 标准化日期格式为 YYYY-MM-DD
 */
function normalizeDate(date: string): string | null {
  const cleaned = String(date || '').replace(/[^0-9]/g, '')

  if (cleaned.length === 8) {
    // YYYYMMDD -> YYYY-MM-DD
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  return null
}

/**
 * 解析日期字符串为 Date 对象
 */
function parseDate(date: string): Date | null {
  const normalized = normalizeDate(date)
  if (!normalized) return null

  const d = new Date(normalized)
  return isNaN(d.getTime()) ? null : d
}

/**
 * 格式化 Date 对象为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 获取今天的日期（YYYYMMDD格式）
 */
export function todayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * 获取N天前的日期（YYYYMMDD格式）
 */
export function daysAgoYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * 获取N天后的日期（YYYYMMDD格式）
 */
export function daysLaterYmd(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}
