'use client'

/**
 * 纯 SVG 手绘 K 线图 + 成交量柱状图
 * 不依赖任何第三方图表库
 */

interface KlineBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface KlineChartProps {
  data: KlineBar[]
  width?: number
  height?: number
}

export function KlineChart({ data, width = 720, height = 340 }: KlineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--fg-muted)]"
        style={{ width, height }}
      >
        暂无 K 线数据
      </div>
    )
  }

  // --- 布局参数 ---
  const paddingLeft = 58
  const paddingRight = 12
  const paddingTop = 16
  const klineAreaHeight = height * 0.65
  const volumeAreaHeight = height * 0.22
  const gapBetween = height * 0.06
  const paddingBottom = height * 0.07

  const chartW = width - paddingLeft - paddingRight
  const klineTop = paddingTop
  const klineBottom = klineTop + klineAreaHeight
  const volTop = klineBottom + gapBetween
  const volBottom = volTop + volumeAreaHeight

  const barCount = data.length
  const barTotalW = chartW / barCount
  const barW = Math.max(1, barTotalW * 0.7)
  const barGap = barTotalW * 0.15

  // --- 价格范围 ---
  let pMin = Infinity
  let pMax = -Infinity
  let vMax = 0
  for (const d of data) {
    if (d.low < pMin) pMin = d.low
    if (d.high > pMax) pMax = d.high
    if (d.volume > vMax) vMax = d.volume
  }
  if (pMin === pMax) { pMin -= 1; pMax += 1 }
  if (vMax === 0) vMax = 1
  // 上下留 5% 余量
  const pRange = pMax - pMin
  pMin -= pRange * 0.05
  pMax += pRange * 0.05

  const priceToY = (p: number) =>
    klineTop + (1 - (p - pMin) / (pMax - pMin)) * klineAreaHeight

  const volToH = (v: number) => (v / vMax) * volumeAreaHeight

  const xOf = (i: number) => paddingLeft + barGap + i * barTotalW

  // --- 价格网格线 ---
  const gridLines = 4
  const gridElements: { y: number; label: string }[] = []
  for (let i = 0; i <= gridLines; i++) {
    const p = pMin + ((pMax - pMin) * i) / gridLines
    gridElements.push({ y: priceToY(p), label: p.toFixed(2) })
  }

  // --- 日期标签 ---
  const dateLabelStep = Math.max(1, Math.floor(barCount / 5))
  const dateLabels: { x: number; label: string }[] = []
  for (let i = 0; i < barCount; i += dateLabelStep) {
    const t = data[i].time
    const formatted = t.length === 8
      ? `${t.slice(4, 6)}-${t.slice(6, 8)}`
      : t.length >= 10
        ? t.slice(5, 10)
        : t
    dateLabels.push({ x: xOf(i) + barW / 2, label: formatted })
  }

  // --- 5日 / 10日均线 ---
  const calcMA = (n: number): { x: number; y: number }[] => {
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < data.length; i++) {
      if (i < n - 1) continue
      let sum = 0
      for (let j = i - n + 1; j <= i; j++) sum += data[j].close
      pts.push({ x: xOf(i) + barW / 2, y: priceToY(sum / n) })
    }
    return pts
  }
  const ma5 = calcMA(5)
  const ma10 = calcMA(10)
  const maToPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // --- 颜色 ---
  const upColor = 'var(--kline-up, #ef4444)'
  const downColor = 'var(--kline-down, #22c55e)'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className="select-none"
      style={{ maxWidth: width }}
    >
      {/* 背景 */}
      <rect width={width} height={height} fill="transparent" />

      {/* 价格网格 */}
      {gridElements.map((g, i) => (
        <g key={i}>
          <line
            x1={paddingLeft}
            y1={g.y}
            x2={width - paddingRight}
            y2={g.y}
            stroke="var(--border, #e5e7eb)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
          <text
            x={paddingLeft - 6}
            y={g.y + 3.5}
            textAnchor="end"
            fill="var(--fg-muted, #9ca3af)"
            fontSize="10"
            fontFamily="monospace"
          >
            {g.label}
          </text>
        </g>
      ))}

      {/* K线蜡烛 */}
      {data.map((d, i) => {
        const x = xOf(i)
        const cx = x + barW / 2
        const isUp = d.close >= d.open
        const color = isUp ? upColor : downColor
        const bodyTop = priceToY(Math.max(d.open, d.close))
        const bodyBot = priceToY(Math.min(d.open, d.close))
        const bodyH = Math.max(0.8, bodyBot - bodyTop)

        return (
          <g key={i}>
            {/* 影线 */}
            <line
              x1={cx} y1={priceToY(d.high)}
              x2={cx} y2={priceToY(d.low)}
              stroke={color}
              strokeWidth="1"
            />
            {/* 实体 */}
            <rect
              x={x}
              y={bodyTop}
              width={barW}
              height={bodyH}
              fill={isUp ? 'transparent' : color}
              stroke={color}
              strokeWidth="0.8"
            />
          </g>
        )
      })}

      {/* MA5 */}
      {ma5.length > 1 && (
        <path
          d={maToPath(ma5)}
          fill="none"
          stroke="var(--ma5, #f59e0b)"
          strokeWidth="1.2"
          opacity="0.8"
        />
      )}

      {/* MA10 */}
      {ma10.length > 1 && (
        <path
          d={maToPath(ma10)}
          fill="none"
          stroke="var(--ma10, #8b5cf6)"
          strokeWidth="1.2"
          opacity="0.8"
        />
      )}

      {/* MA 图例 */}
      <line x1={paddingLeft} y1={klineTop - 6} x2={paddingLeft + 16} y2={klineTop - 6} stroke="var(--ma5, #f59e0b)" strokeWidth="1.5" />
      <text x={paddingLeft + 20} y={klineTop - 3} fontSize="9" fill="var(--fg-muted, #9ca3af)">MA5</text>
      <line x1={paddingLeft + 48} y1={klineTop - 6} x2={paddingLeft + 64} y2={klineTop - 6} stroke="var(--ma10, #8b5cf6)" strokeWidth="1.5" />
      <text x={paddingLeft + 68} y={klineTop - 3} fontSize="9" fill="var(--fg-muted, #9ca3af)">MA10</text>

      {/* 成交量分隔线 */}
      <line
        x1={paddingLeft}
        y1={volTop - 2}
        x2={width - paddingRight}
        y2={volTop - 2}
        stroke="var(--border, #e5e7eb)"
        strokeWidth="0.5"
      />
      <text
        x={paddingLeft - 6}
        y={volTop + 10}
        textAnchor="end"
        fill="var(--fg-muted, #9ca3af)"
        fontSize="9"
      >
        VOL
      </text>

      {/* 成交量柱 */}
      {data.map((d, i) => {
        const x = xOf(i)
        const h = volToH(d.volume)
        const isUp = d.close >= d.open
        const color = isUp ? upColor : downColor
        return (
          <rect
            key={`v-${i}`}
            x={x}
            y={volBottom - h}
            width={barW}
            height={Math.max(0.5, h)}
            fill={color}
            opacity="0.55"
          />
        )
      })}

      {/* 日期标签 */}
      {dateLabels.map((dl, i) => (
        <text
          key={i}
          x={dl.x}
          y={height - 2}
          textAnchor="middle"
          fill="var(--fg-muted, #9ca3af)"
          fontSize="9"
          fontFamily="monospace"
        >
          {dl.label}
        </text>
      ))}
    </svg>
  )
}
