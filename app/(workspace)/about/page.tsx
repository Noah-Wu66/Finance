import { Card } from '@/components/ui/card'

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-[var(--fg)] m-0">关于项目</h3>
        <div className="mt-3 space-y-2 text-sm text-[var(--fg-secondary)]">
          <p className="m-0">
            Finance Agents 网页版已重构为 Next.js App Router 全栈单服务，所有核心能力都在网页中现场执行。
          </p>
          <p className="m-0">
            当前模式下不再依赖后台常驻 Worker、定时调度器和 WebSocket 服务端。
          </p>
        </div>
      </Card>
    </div>
  )
}
