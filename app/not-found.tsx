import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="login-page">
      <div className="login-card card">
        <h1>页面不存在</h1>
        <p>你访问的地址已经不存在或已调整。</p>
        <Link className="btn btn-primary" href="/dashboard">
          回到总览
        </Link>
      </div>
    </div>
  )
}
