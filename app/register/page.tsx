'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/client-api'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
          username,
          email,
          password,
          confirm_password: confirmPassword
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
    <div className="login-page">
      <div className="login-card card">
        <h1>注册账号</h1>
        <p>创建你的现场执行账号，注册后将自动登录。</p>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <label>用户名</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>邮箱</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="field">
            <label>密码</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </div>
          <div className="field">
            <label>确认密码</label>
            <input className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '注册中...' : '立即注册'}
          </button>

          <Link href="/login" className="muted">
            已有账号？去登录
          </Link>
        </form>
      </div>
    </div>
  )
}
