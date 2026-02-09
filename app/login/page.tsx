'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { apiFetch } from '@/lib/client-api'

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
    <div className="login-page">
      <div className="login-card card">
        <h1>TradingAgents 网页版</h1>
        <p>全功能现场执行模式：所有任务都在你当前页面里运行。</p>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>

          <Link href="/register" className="muted">
            没有账号？去注册
          </Link>
        </form>
      </div>
    </div>
  )
}
