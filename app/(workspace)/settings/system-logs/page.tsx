'use client'

import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

interface LogReadResp {
  filename: string
  lines: string[]
  stats: {
    total_lines: number
    filtered_lines: number
    error_count: number
    warning_count: number
    info_count: number
    debug_count: number
  }
}

export default function SettingsSystemLogsPage() {
  const [content, setContent] = useState<LogReadResp | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<LogReadResp>('/api/system/system-logs/read', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'operation.log',
          lines: 200,
          keyword: keyword || undefined
        })
      })
      setContent(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统日志"
        description="现场执行模式下系统日志来自数据库操作记录"
        actions={
          <div className="flex items-center gap-2">
            <input
              className="
                rounded-lg border border-[var(--input-border)]
                bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)]
                placeholder:text-[var(--fg-muted)]
                outline-none transition-all duration-150
                focus:border-[var(--input-focus)] focus:ring-2 focus:ring-[var(--input-focus)]/20
                w-40
              "
              placeholder="关键词过滤"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading && <Spinner size="sm" />}
              读取日志
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <h4 className="text-sm font-semibold text-[var(--fg)] m-0 mb-3">日志内容</h4>
        <pre className="whitespace-pre-wrap font-mono text-xs bg-[var(--bg-secondary)] text-[var(--fg-secondary)] rounded-lg p-4 overflow-auto max-h-[500px] border border-[var(--border)] m-0">
          {content?.lines?.join('\n') || '暂无日志内容'}
        </pre>
      </Card>
    </div>
  )
}
