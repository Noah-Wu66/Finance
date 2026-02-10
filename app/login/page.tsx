'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { apiFetch } from '@/lib/client-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })

      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)] px-4 py-6 sm:py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 text-white font-bold text-xl mb-4">
            T
          </div>
          <h1 className="text-xl font-semibold text-[var(--fg)] m-0">登录 TradingAgents</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">AI 驱动的智能股票分析平台</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--card-shadow-lg)] p-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              id="email"
              label="邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />

            <Input
              id="password"
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
            />

            {error && <Alert variant="error">{error}</Alert>}

            <Button variant="primary" type="submit" disabled={loading} className="w-full">
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          没有账号？
          <Link href="/register" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 ml-1 font-medium">
            注册
          </Link>
        </p>
      </div>
    </div>
  )
}
