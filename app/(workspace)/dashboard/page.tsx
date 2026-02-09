'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

interface Summary {
  running: number
  completed: number
  failed: number
  stopped: number
  reports: number
  favorites: number
}

const statItems = [
  { key: 'running', label: '运行中', color: 'text-primary-600 dark:text-primary-400' },
  { key: 'completed', label: '已完成', color: 'text-success-600 dark:text-success-400' },
  { key: 'failed', label: '失败', color: 'text-danger-600 dark:text-danger-400' },
  { key: 'stopped', label: '停止/取消', color: 'text-warning-600 dark:text-warning-400' },
  { key: 'reports', label: '报告总数', color: 'text-[var(--fg)]' },
  { key: 'favorites', label: '自选股', color: 'text-[var(--fg)]' }
] as const

const quickLinks = [
  { href: '/analysis', label: '开始分析', desc: '发起 AI 股票分析任务', icon: '→' },
  { href: '/executions', label: '执行中心', desc: '查看所有任务状态', icon: '→' },
  { href: '/reports', label: '报告中心', desc: '浏览分析报告', icon: '→' },
  { href: '/favorites', label: '自选股', desc: '管理关注的股票', icon: '→' }
]

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<Summary>('/api/dashboard/summary')
      setSummary(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="总览"
        description="查看执行状态和快速操作"
        actions={
          <Button variant="secondary" onClick={loadSummary} disabled={loading}>
            {loading && <Spinner size="sm" />}
            刷新
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {statItems.map((item) => (
          <Card key={item.key} className="p-4">
            <p className="text-xs text-[var(--fg-muted)] m-0">{item.label}</p>
            <p className={`text-2xl font-semibold mt-1 m-0 tabular-nums ${item.color}`}>
              {summary?.[item.key] ?? '-'}
            </p>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-3">快速入口</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="p-4 group hover:shadow-[var(--card-shadow-lg)] hover:border-primary-200 dark:hover:border-primary-700/40 transition-all duration-200 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--fg)] m-0 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)] mt-0.5 m-0">{link.desc}</p>
                  </div>
                  <span className="text-[var(--fg-faint)] group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
