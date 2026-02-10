import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsSchedulerPage() {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-[var(--fg)] m-0">定时任务管理</h3>
        <p className="mt-2 text-sm text-[var(--fg-secondary)] m-0">
          系统已重构为"网页现场执行"模式：不再提供后台常驻调度器。
        </p>
        <p className="mt-1 text-sm text-[var(--fg-muted)] m-0">你可以在下面两个入口完成同样目标：</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Link href="/executions">
            <Button variant="primary" className="w-full">去执行中心手动推进任务</Button>
          </Link>
          <Link href="/settings/sync">
            <Button variant="soft" className="w-full">去数据同步页手动触发同步</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
