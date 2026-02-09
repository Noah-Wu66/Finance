'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from '@/lib/client-api'

const navItems = [
  { href: '/dashboard', label: '总览' },
  { href: '/analysis', label: '现场分析' },
  { href: '/screening', label: '股票筛选' },
  { href: '/executions', label: '执行中心' },
  { href: '/reports', label: '报告中心' },
  { href: '/paper', label: '模拟交易' },
  { href: '/learning', label: '学习中心' },
  { href: '/favorites', label: '自选股' },
  { href: '/settings', label: '偏好设置' }
]

interface NotifItem {
  id: string
  title: string
  content?: string
  type: 'analysis' | 'alert' | 'system'
  status: 'unread' | 'read'
  created_at: string
  link?: string
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  // 通知状态
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const popoverRef = useRef<HTMLDivElement>(null)

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

  // 轮询未读数量
  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiFetch<{ count: number }>('/api/notifications/unread_count')
      setUnreadCount(res.data.count)
    } catch {
    }
  }, [])

  useEffect(() => {
    void fetchUnread()
    const timer = window.setInterval(fetchUnread, 10000)
    return () => window.clearInterval(timer)
  }, [fetchUnread])

  // 打开弹窗时加载通知列表
  const loadNotifications = async () => {
    try {
      const res = await apiFetch<{ items: NotifItem[] }>('/api/notifications?status=all&page=1&page_size=20')
      setNotifItems(res.data.items || [])
    } catch {
    }
  }

  const toggleNotif = async () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) {
      await loadNotifications()
    }
  }

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' })
    await loadNotifications()
    await fetchUnread()
  }

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read_all', { method: 'POST' })
    await loadNotifications()
    setUnreadCount(0)
  }

  // 点击弹窗外部关闭
  useEffect(() => {
    if (!notifOpen) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

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

          <div className="notif-bell-wrap" ref={popoverRef}>
            <button className="notif-bell" onClick={toggleNotif} aria-label="通知">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="notif-popover">
                <div className="notif-popover-head">
                  <strong>通知</strong>
                  <button className="btn-text" onClick={markAllRead}>全部已读</button>
                </div>
                <div className="notif-popover-body">
                  {notifItems.length === 0 ? (
                    <p className="muted notif-empty">暂无通知</p>
                  ) : (
                    notifItems.map((item) => (
                      <div
                        className={`notif-row ${item.status === 'unread' ? 'notif-unread' : ''}`}
                        key={item.id}
                        onClick={() => item.status === 'unread' && markRead(item.id)}
                      >
                        <div className="notif-row-title">{item.title}</div>
                        {item.content && <div className="notif-row-content muted">{item.content}</div>}
                        <div className="notif-row-time muted">{new Date(item.created_at).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="shell-content">{children}</section>
      </main>
    </div>
  )
}
