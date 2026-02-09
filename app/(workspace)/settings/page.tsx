'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

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
    <div className="container report-grid">
      <section className="card report-head">
        <div>
          <h3>偏好设置</h3>
          <p className="muted">设置默认市场和自动刷新行为。</p>
        </div>
      </section>

      <section className="card report-panel">
        {loading ? (
          <p className="muted">加载中...</p>
        ) : (
          <form className="settings-form" onSubmit={save}>
            <div className="field">
              <label>默认市场</label>
              <select
                className="select"
                value={form.default_market}
                onChange={(e) => setForm((prev) => ({ ...prev, default_market: e.target.value }))}
              >
                <option value="A股">A股</option>
                <option value="港股">港股</option>
                <option value="美股">美股</option>
              </select>
            </div>

            <div className="field">
              <label>自动刷新间隔（秒）</label>
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                value={form.refresh_interval}
                onChange={(e) => setForm((prev) => ({ ...prev, refresh_interval: Number(e.target.value) || 3 }))}
              />
            </div>

            <label className="live-toggle">
              <input
                type="checkbox"
                checked={form.auto_refresh}
                onChange={(e) => setForm((prev) => ({ ...prev, auto_refresh: e.target.checked }))}
              />
              默认启用自动刷新
            </label>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </button>
          </form>
        )}
      </section>

      <section className="card report-panel">
        <h4>系统功能入口</h4>
        <div className="quick-grid">
          <Link className="quick-link" href="/settings/database">
            数据库管理
          </Link>
          <Link className="quick-link" href="/settings/cache">
            缓存管理
          </Link>
          <Link className="quick-link" href="/settings/usage">
            使用统计
          </Link>
          <Link className="quick-link" href="/settings/logs">
            操作日志
          </Link>
          <Link className="quick-link" href="/settings/system-logs">
            系统日志
          </Link>
          <Link className="quick-link" href="/settings/sync">
            多数据源同步
          </Link>
          <Link className="quick-link" href="/settings/scheduler">
            定时任务迁移说明
          </Link>
        </div>
      </section>

      {message ? <div className="card message-ok">{message}</div> : null}
      {error ? <div className="card board-error">{error}</div> : null}
    </div>
  )
}
