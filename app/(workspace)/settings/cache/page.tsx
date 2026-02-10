'use client'

import { useEffect, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
import { apiFetch } from '@/lib/client-api'

interface CacheStats {
  totalFiles: number
  stockDataCount: number
  newsDataCount: number
  analysisDataCount: number
}

export default function SettingsCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<CacheStats>('/api/cache/stats')
      setStats(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const clear = async () => {
    await apiFetch('/api/cache/clear', { method: 'DELETE' })
    await load()
  }

  const cleanup = async () => {
    await apiFetch('/api/cache/cleanup?days=7', { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="缓存管理"
        description="现场执行模式下缓存存储在 MongoDB 集合 `app_cache`。"
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="soft" onClick={load} disabled={loading}>
              {loading ? '刷新中...' : '刷新'}
            </Button>
            <Button variant="secondary" onClick={cleanup}>
              清理7天前缓存
            </Button>
            <Button variant="danger" onClick={clear}>
              清空全部缓存
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading && !stats ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs text-[var(--fg-muted)]">总条目</p>
            <p className="text-xl sm:text-2xl font-semibold text-[var(--fg)] mt-1">
              {stats?.totalFiles ?? '-'}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--fg-muted)]">股票缓存</p>
            <p className="text-xl sm:text-2xl font-semibold text-[var(--fg)] mt-1">
              {stats?.stockDataCount ?? '-'}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--fg-muted)]">新闻缓存</p>
            <p className="text-xl sm:text-2xl font-semibold text-[var(--fg)] mt-1">
              {stats?.newsDataCount ?? '-'}
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
