'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

const navItems = [
  { href: '/dashboard', label: '总览' },
  { href: '/analysis', label: '现场分析' },
  { href: '/screening', label: '股票筛选' },
  { href: '/executions', label: '执行中心' },
  { href: '/reports', label: '报告中心' },
  { href: '/paper', label: '模拟交易' },
  { href: '/learning', label: '学习中心' },
  { href: '/notifications', label: '通知中心' },
  { href: '/favorites', label: '自选股' },
  { href: '/settings', label: '偏好设置' }
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const title = useMemo(() => {
    const hit = navItems.find((item) => pathname.startsWith(item.href))
    return hit?.label || 'TradingAgents 网页版'
  }, [pathname])

  useEffect(() => {
    const handleBeforeUnload = () => {
      fetch('/api/executions/stop-running', {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetch('/api/executions?limit=20', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      }).catch(() => {
      })
    }, 2800)

    return () => window.clearInterval(timer)
  }, [])

  const logout = async () => {
    setLoggingOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
      router.refresh()
    } catch {
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="shell-wrap">
      <aside className="shell-side card">
        <div className="brand-wrap">
          <h1>TradingAgents</h1>
          <p>网页现场执行模式</p>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link className={`nav-link ${active ? 'active' : ''}`} key={item.href} href={item.href}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button className="btn btn-danger logout-btn" onClick={logout} disabled={loggingOut}>
          {loggingOut ? '正在退出...' : '退出登录'}
        </button>
      </aside>

      <main className="shell-main">
        <header className="shell-head card">
          <div>
            <h2>{title}</h2>
            <p className="muted">页面在线时才会继续执行任务，关闭页面即停止。</p>
          </div>
        </header>

        <section className="shell-content">{children}</section>
      </main>
    </div>
  )
}
