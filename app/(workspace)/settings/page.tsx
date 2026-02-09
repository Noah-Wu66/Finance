'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
import { apiFetch } from '@/lib/client-api'

interface Preferences {
  default_market: string
  auto_refresh: boolean
  refresh_interval: number
  language: string
}

const defaultPreferences: Preferences = {
  default_market: 'A股',
  auto_refresh: true,
  refresh_interval: 3,
  language: 'zh-CN'
}

const systemLinks = [
  { href: '/settings/database', label: '数据库管理' },
  { href: '/settings/cache', label: '缓存管理' },
  { href: '/settings/usage', label: '使用统计' },
  { href: '/settings/logs', label: '操作日志' },
  { href: '/settings/system-logs', label: '系统日志' },
  { href: '/settings/sync', label: '多数据源同步' },
  { href: '/settings/scheduler', label: '定时任务迁移说明' },
]

export default function SettingsPage() {
  const [form, setForm] = useState<Preferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<Preferences>('/api/settings/preferences')
      setForm({ ...defaultPreferences, ...res.data })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await apiFetch<Preferences>('/api/settings/preferences', {
        method: 'PUT',
        body: JSON.stringify(form)
      })
      setForm(res.data)
      setMessage('保存成功')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="偏好设置" description="设置默认市场和自动刷新行为。" />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <form onSubmit={save} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Select
                label="默认市场"
                value={form.default_market}
                onChange={(e) => setForm((prev) => ({ ...prev, default_market: e.target.value }))}
              >
                <option value="A股">A股</option>
                <option value="港股">港股</option>
                <option value="美股">美股</option>
              </Select>

              <Input
                label="自动刷新间隔（秒）"
                type="number"
                min={1}
                max={60}
                value={form.refresh_interval}
                onChange={(e) => setForm((prev) => ({ ...prev, refresh_interval: Number(e.target.value) || 3 }))}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--fg-secondary)]">
              <input
                type="checkbox"
                checked={form.auto_refresh}
                onChange={(e) => setForm((prev) => ({ ...prev, auto_refresh: e.target.checked }))}
                className="rounded border-[var(--border)]"
              />
              默认启用自动刷新
            </label>

            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">系统功能入口</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {systemLinks.map((item) => (
            <Link key={item.href} href={item.href} className="no-underline">
              <Card
                className="text-center text-sm font-medium text-[var(--fg-secondary)] hover:border-[var(--fg-muted)] transition-colors cursor-pointer"
                padding={false}
              >
                <div className="px-4 py-3">{item.label}</div>
              </Card>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
