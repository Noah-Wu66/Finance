export default function AboutPage() {
  return (
    <div className="container report-grid">
      <section className="card report-panel">
        <h3>关于项目</h3>
        <p>
          TradingAgents 网页版已重构为 Next.js App Router 全栈单服务，所有核心能力都在网页中现场执行。
        </p>
        <p>当前模式下不再依赖后台常驻 Worker、定时调度器和 WebSocket 服务端。</p>
      </section>
    </div>
  )
}
