'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from '@/lib/client-api'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/* ========== Nav Config ========== */

const navItems = [
  {
    href: '/dashboard',
    label: '总览',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    href: '/analysis',
    label: '量化分析',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    href: '/screening',
    label: '股票筛选',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    )
  },
  {
    href: '/executions',
    label: '执行中心',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    )
  },
  {
    href: '/favorites',
    label: '自选股',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    )
  },
  {
    href: '/settings',
    label: '偏好设置',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  }
]

/* ========== Notification Types ========== */

interface NotifItem {
  id: string
  title: string
  content?: string
  type: 'analysis' | 'alert' | 'system'
  status: 'unread' | 'read'
  created_at: string
  link?: string
}

/* ========== AppShell ========== */

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 通知状态
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState<NotifItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const popoverRef = useRef<HTMLDivElement>(null)

  const title = useMemo(() => {
    const hit = navItems.find((item) => pathname.startsWith(item.href))
    return hit?.label || 'TradingAgents'
  }, [pathname])

  // 页面关闭时停止运行中的任务
  useEffect(() => {
    const handleBeforeUnload = () => {
      fetch('/api/executions/stop-running', {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(() => {})
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // 轮询执行状态
  useEffect(() => {
    const timer = window.setInterval(() => {
      fetch('/api/executions?limit=20', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      }).catch(() => {})
    }, 2800)
    return () => window.clearInterval(timer)
  }, [])

  // 轮询未读通知数量
  const fetchUnread = useCallback(async () => {
    try {
      const res = await apiFetch<{ count: number }>('/api/notifications/unread_count')
      setUnreadCount(res.data.count)
    } catch {}
  }, [])

  useEffect(() => {
    void fetchUnread()
    const timer = window.setInterval(fetchUnread, 10000)
    return () => window.clearInterval(timer)
  }, [fetchUnread])

  // 加载通知列表
  const loadNotifications = async () => {
    try {
      const res = await apiFetch<{ items: NotifItem[] }>('/api/notifications?status=all&page=1&page_size=20')
      setNotifItems(res.data.items || [])
    } catch {}
  }

  const toggleNotif = async () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) await loadNotifications()
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

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

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

  // 侧边栏折叠状态持久化
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  /* ========== Sidebar Content ========== */
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 h-14 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 text-white font-bold text-sm shrink-0">
          T
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[var(--fg)] m-0 truncate">TradingAgents</h1>
            <p className="text-[11px] text-[var(--fg-muted)] m-0">AI 股票分析平台</p>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto flex lg:hidden items-center justify-center h-8 w-8 rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]"
          aria-label="关闭菜单"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`
                group flex items-center gap-3 rounded-lg
                transition-all duration-150 relative
                ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
                ${active
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-700/15 dark:text-primary-300'
                  : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
                }
              `}
            >
              <span className={`shrink-0 ${active ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-[13px] font-medium truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 space-y-1 shrink-0">
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={toggleCollapse}
          className="
            hidden lg:flex items-center gap-3 w-full rounded-lg
            px-3 py-2 text-[13px] font-medium
            text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]
            transition-colors duration-150 cursor-pointer
          "
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          {!collapsed && <span>收起侧栏</span>}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          disabled={loggingOut}
          className={`
            flex items-center gap-3 w-full rounded-lg
            px-3 py-2 text-[13px] font-medium
            text-[var(--fg-muted)] hover:bg-danger-50 hover:text-danger-600
            dark:hover:bg-danger-700/15 dark:hover:text-danger-400
            transition-colors duration-150 cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!collapsed && <span>{loggingOut ? '退出中...' : '退出登录'}</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]
          transition-all duration-200 ease-out
          lg:relative lg:z-auto
          ${collapsed ? 'lg:w-16' : 'lg:w-60'}
          ${mobileOpen ? 'w-72 max-w-[86vw] translate-x-0' : 'w-72 max-w-[86vw] -translate-x-full lg:w-60 lg:max-w-none lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="
          flex items-center justify-between gap-4
          h-[52px] sm:h-14 px-3 sm:px-4 lg:px-6
          border-b border-[var(--border)]
          bg-[var(--card-bg)]
          shrink-0
        ">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="
                flex items-center justify-center
                h-8 w-8 rounded-lg lg:hidden
                text-[var(--fg-secondary)]
                hover:bg-[var(--bg-hover)]
                transition-colors cursor-pointer
              "
              aria-label="打开菜单"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

              <h2 className="text-sm font-semibold text-[var(--fg)] m-0 truncate">{title}</h2>
            </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            {/* Notification bell */}
            <div className="relative" ref={popoverRef}>
              <button
                onClick={toggleNotif}
                className="
                  flex items-center justify-center
                  h-8 w-8 rounded-lg relative
                  text-[var(--fg-secondary)]
                  hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]
                  transition-colors duration-150 cursor-pointer
                "
                aria-label="通知"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="
                  absolute top-full right-0 mt-2
                  w-[calc(100vw-1.5rem)] max-w-80 max-h-[70vh] sm:max-h-[420px]
                  bg-[var(--card-bg)] border border-[var(--border)]
                  rounded-xl shadow-[var(--card-shadow-lg)]
                  z-50 flex flex-col overflow-hidden
                ">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <span className="text-sm font-semibold text-[var(--fg)]">通知</span>
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 cursor-pointer"
                    >
                      全部已读
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifItems.length === 0 ? (
                      <p className="py-10 text-center text-sm text-[var(--fg-muted)]">暂无通知</p>
                    ) : (
                      notifItems.map((item) => (
                        <div
                          key={item.id}
                          className={`
                            px-4 py-3 border-b border-[var(--border)] last:border-b-0
                            cursor-pointer transition-colors hover:bg-[var(--bg-hover)]
                            ${item.status === 'unread' ? 'bg-primary-50/50 dark:bg-primary-700/5' : ''}
                          `}
                          onClick={() => item.status === 'unread' && markRead(item.id)}
                        >
                          <div className={`text-[13px] ${item.status === 'unread' ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-secondary)]'}`}>
                            {item.title}
                          </div>
                          {item.content && (
                            <div className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-2">{item.content}</div>
                          )}
                          <div className="text-[11px] text-[var(--fg-muted)] mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
