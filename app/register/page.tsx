'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/client-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          confirm_password: confirmPassword,
          nickname: nickname || undefined
        })
      })
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
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
          <h1 className="text-xl font-semibold text-[var(--fg)] m-0">注册 Finance Agents</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">创建账号，开始使用 AI 股票分析</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--card-shadow-lg)] p-5 sm:p-6">
          <form className="space-y-4" onSubmit={submit}>
            <Input
              label="邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />

            <Input
              label="昵称（选填）"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="设置一个昵称"
            />

            <Input
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码"
            />

            <Input
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
            />

            {error && <Alert variant="error">{error}</Alert>}

            <Button variant="primary" type="submit" disabled={loading} className="w-full">
              {loading ? '注册中...' : '注册'}
            </Button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          已有账号？
          <Link href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 ml-1 font-medium">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}
