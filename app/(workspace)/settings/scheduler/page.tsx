import Link from 'next/link'

export default function SettingsSchedulerPage() {
  return (
    <div className="container report-grid">
      <section className="card report-panel">
        <h3>定时任务管理</h3>
        <p>
          系统已重构为“网页现场执行”模式：不再提供后台常驻调度器。
        </p>
        <p>你可以在下面两个入口完成同样目标：</p>
        <div className="execution-actions">
          <Link className="btn btn-primary" href="/executions">
            去执行中心手动推进任务
          </Link>
          <Link className="btn btn-soft" href="/settings/sync">
            去数据同步页手动触发同步
          </Link>
        </div>
      </section>
    </div>
  )
}
