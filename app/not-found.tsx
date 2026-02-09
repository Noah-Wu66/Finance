import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-[var(--fg-faint)] m-0">404</p>
        <h1 className="mt-4 text-lg font-semibold text-[var(--fg)] m-0">页面不存在</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)] m-0">你访问的地址已经不存在或已调整。</p>
        <Link
          href="/dashboard"
          className="
            inline-flex items-center justify-center mt-6
            px-4 py-2 text-sm font-medium rounded-lg
            bg-primary-600 text-white hover:bg-primary-700
            transition-colors
          "
        >
          回到总览
        </Link>
      </div>
    </div>
  )
}
