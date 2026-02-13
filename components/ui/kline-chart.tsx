'use client'

/**
 * 纯 SVG 手绘 K 线图 + 成交量柱状图
 * 支持鼠标悬停十字光标 + OHLCV 详情
 * 不依赖任何第三方图表库
 */

import { useCallback, useRef, useState } from 'react'

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
  /** 从该索引开始的K线为预测数据，用虚线/半透明样式区分 */
  predictStartIndex?: number
}

export function KlineChart({ data, width = 720, height = 340, predictStartIndex }: KlineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)

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
  const paddingTop = 28 // 留出顶部信息栏空间
  const klineAreaHeight = height * 0.60
  const volumeAreaHeight = height * 0.20
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

  const yToPrice = (y: number) =>
    pMin + (1 - (y - klineTop) / klineAreaHeight) * (pMax - pMin)

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

  // --- 鼠标事件 ---
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // 将屏幕坐标转换为 SVG viewBox 坐标
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const svgX = (e.clientX - rect.left) * scaleX
    const svgY = (e.clientY - rect.top) * scaleY

    // 计算悬停的 bar 索引
    const relX = svgX - paddingLeft
    if (relX < 0 || relX > chartW) {
      setHoverIndex(null)
      setMouseY(null)
      return
    }
    const idx = Math.floor(relX / barTotalW)
    const clampedIdx = Math.max(0, Math.min(barCount - 1, idx))
    setHoverIndex(clampedIdx)
    // 限制 Y 在 K 线区域内
    const clampedY = Math.max(klineTop, Math.min(klineBottom, svgY))
    setMouseY(clampedY)
  }, [width, height, paddingLeft, chartW, barTotalW, barCount, klineTop, klineBottom])

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null)
    setMouseY(null)
  }, [])

  // --- 悬停数据 ---
  const hoverBar = hoverIndex !== null ? data[hoverIndex] : null
  const hoverCx = hoverIndex !== null ? xOf(hoverIndex) + barW / 2 : 0
  const hoverIsPredicted = hoverIndex !== null && predictStartIndex !== undefined && hoverIndex >= predictStartIndex

  // 格式化日期
  const formatDate = (t: string) => {
    if (t.length === 8) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
    if (t.length >= 10) return t.slice(0, 10)
    return t
  }

  // 格式化成交量
  const formatVolume = (v: number) => {
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
    if (v >= 1e4) return (v / 1e4).toFixed(2) + '万'
    return v.toFixed(0)
  }

  // 涨跌幅
  const changePercent = hoverBar && hoverBar.open !== 0
    ? ((hoverBar.close - hoverBar.open) / hoverBar.open * 100).toFixed(2)
    : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className="select-none"
      style={{ maxWidth: width, cursor: hoverIndex !== null ? 'crosshair' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* 背景 */}
      <rect width={width} height={height} fill="transparent" />

      {/* 顶部 OHLCV 信息栏 */}
      {hoverBar ? (
        <g>
          {hoverIsPredicted && (
            <text x={paddingLeft} y={12} fontSize="10" fill="var(--ma5, #f59e0b)" fontWeight="bold">
              [预测]
            </text>
          )}
          <text x={paddingLeft + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)" fontFamily="monospace">
            {formatDate(hoverBar.time)}
          </text>
          <text x={paddingLeft + 90 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)">
            开
          </text>
          <text x={paddingLeft + 102 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill={hoverBar.close >= hoverBar.open ? upColor : downColor} fontFamily="monospace">
            {hoverBar.open.toFixed(2)}
          </text>
          <text x={paddingLeft + 155 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)">
            高
          </text>
          <text x={paddingLeft + 167 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill={hoverBar.close >= hoverBar.open ? upColor : downColor} fontFamily="monospace">
            {hoverBar.high.toFixed(2)}
          </text>
          <text x={paddingLeft + 220 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)">
            低
          </text>
          <text x={paddingLeft + 232 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill={hoverBar.close >= hoverBar.open ? upColor : downColor} fontFamily="monospace">
            {hoverBar.low.toFixed(2)}
          </text>
          <text x={paddingLeft + 285 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)">
            收
          </text>
          <text x={paddingLeft + 297 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill={hoverBar.close >= hoverBar.open ? upColor : downColor} fontFamily="monospace" fontWeight="bold">
            {hoverBar.close.toFixed(2)}
          </text>
          <text x={paddingLeft + 355 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill={hoverBar.close >= hoverBar.open ? upColor : downColor} fontFamily="monospace">
            {Number(changePercent) >= 0 ? '+' : ''}{changePercent}%
          </text>
          <text x={paddingLeft + 415 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)">
            量
          </text>
          <text x={paddingLeft + 427 + (hoverIsPredicted ? 42 : 0)} y={12} fontSize="10" fill="var(--fg-muted, #9ca3af)" fontFamily="monospace">
            {formatVolume(hoverBar.volume)}
          </text>
        </g>
      ) : (
        <g>
          {/* MA 图例（无悬停时显示） */}
          <line x1={paddingLeft} y1={klineTop - 6} x2={paddingLeft + 16} y2={klineTop - 6} stroke="var(--ma5, #f59e0b)" strokeWidth="1.5" />
          <text x={paddingLeft + 20} y={klineTop - 3} fontSize="9" fill="var(--fg-muted, #9ca3af)">MA5</text>
          <line x1={paddingLeft + 48} y1={klineTop - 6} x2={paddingLeft + 64} y2={klineTop - 6} stroke="var(--ma10, #8b5cf6)" strokeWidth="1.5" />
          <text x={paddingLeft + 68} y={klineTop - 3} fontSize="9" fill="var(--fg-muted, #9ca3af)">MA10</text>
        </g>
      )}

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

      {/* 预测区域分界线 */}
      {predictStartIndex !== undefined && predictStartIndex > 0 && predictStartIndex < barCount && (
        <g>
          <line
            x1={xOf(predictStartIndex) - barGap / 2}
            y1={klineTop}
            x2={xOf(predictStartIndex) - barGap / 2}
            y2={volBottom}
            stroke="var(--fg-muted, #9ca3af)"
            strokeWidth="1"
            strokeDasharray="6,4"
            opacity="0.5"
          />
          <text
            x={xOf(predictStartIndex) - barGap / 2}
            y={klineTop - 2}
            textAnchor="middle"
            fill="var(--fg-muted, #9ca3af)"
            fontSize="8"
          >
            AI 预测
          </text>
          {/* 预测区域背景 */}
          <rect
            x={xOf(predictStartIndex) - barGap / 2}
            y={klineTop}
            width={width - paddingRight - (xOf(predictStartIndex) - barGap / 2)}
            height={volBottom - klineTop}
            fill="var(--fg-muted, #9ca3af)"
            opacity="0.04"
          />
        </g>
      )}

      {/* K线蜡烛 */}
      {data.map((d, i) => {
        const x = xOf(i)
        const cx = x + barW / 2
        const isUp = d.close >= d.open
        const color = isUp ? upColor : downColor
        const bodyTop = priceToY(Math.max(d.open, d.close))
        const bodyBot = priceToY(Math.min(d.open, d.close))
        const bodyH = Math.max(0.8, bodyBot - bodyTop)
        const isHovered = hoverIndex === i
        const isPredicted = predictStartIndex !== undefined && i >= predictStartIndex

        return (
          <g key={i} opacity={hoverIndex !== null && !isHovered ? 0.45 : isPredicted ? 0.7 : 1}>
            {/* 影线 */}
            <line
              x1={cx} y1={priceToY(d.high)}
              x2={cx} y2={priceToY(d.low)}
              stroke={color}
              strokeWidth={isHovered ? 1.8 : 1}
              strokeDasharray={isPredicted ? '3,2' : 'none'}
            />
            {/* 实体 */}
            <rect
              x={x}
              y={bodyTop}
              width={barW}
              height={bodyH}
              fill={isUp ? 'transparent' : color}
              stroke={color}
              strokeWidth={isHovered ? 1.5 : 0.8}
              strokeDasharray={isPredicted ? '3,2' : 'none'}
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
          opacity={hoverIndex !== null ? 0.4 : 0.8}
        />
      )}

      {/* MA10 */}
      {ma10.length > 1 && (
        <path
          d={maToPath(ma10)}
          fill="none"
          stroke="var(--ma10, #8b5cf6)"
          strokeWidth="1.2"
          opacity={hoverIndex !== null ? 0.4 : 0.8}
        />
      )}

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
        const isHovered = hoverIndex === i
        const isPredicted = predictStartIndex !== undefined && i >= predictStartIndex
        return (
          <rect
            key={`v-${i}`}
            x={x}
            y={volBottom - h}
            width={barW}
            height={Math.max(0.5, h)}
            fill={color}
            opacity={hoverIndex !== null ? (isHovered ? 0.85 : 0.25) : isPredicted ? 0.3 : 0.55}
            strokeDasharray={isPredicted ? '2,2' : 'none'}
            stroke={isPredicted ? color : 'none'}
            strokeWidth={isPredicted ? 0.5 : 0}
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

      {/* === 十字光标 === */}
      {hoverIndex !== null && mouseY !== null && hoverBar && (
        <g>
          {/* 垂直线 */}
          <line
            x1={hoverCx}
            y1={klineTop}
            x2={hoverCx}
            y2={volBottom}
            stroke="var(--fg-muted, #9ca3af)"
            strokeWidth="0.6"
            strokeDasharray="4,3"
            opacity="0.7"
          />

          {/* 水平线 */}
          <line
            x1={paddingLeft}
            y1={mouseY}
            x2={width - paddingRight}
            y2={mouseY}
            stroke="var(--fg-muted, #9ca3af)"
            strokeWidth="0.6"
            strokeDasharray="4,3"
            opacity="0.7"
          />

          {/* 右侧价格标签 */}
          <rect
            x={width - paddingRight - 52}
            y={mouseY - 8}
            width={52}
            height={16}
            rx={3}
            fill="var(--fg-secondary, #6b7280)"
          />
          <text
            x={width - paddingRight - 26}
            y={mouseY + 3.5}
            textAnchor="middle"
            fill="#fff"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {yToPrice(mouseY).toFixed(2)}
          </text>

          {/* 底部日期标签 */}
          {(() => {
            const dateStr = formatDate(hoverBar.time)
            const labelW = dateStr.length * 6.5 + 10
            return (
              <>
                <rect
                  x={hoverCx - labelW / 2}
                  y={volBottom + 4}
                  width={labelW}
                  height={16}
                  rx={3}
                  fill="var(--fg-secondary, #6b7280)"
                />
                <text
                  x={hoverCx}
                  y={volBottom + 15}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {dateStr}
                </text>
              </>
            )
          })()}

          {/* 悬停蜡烛高亮圆点（收盘价位置） */}
          <circle
            cx={hoverCx}
            cy={priceToY(hoverBar.close)}
            r={3}
            fill={hoverBar.close >= hoverBar.open ? upColor : downColor}
            stroke="#fff"
            strokeWidth="1"
          />
        </g>
      )}

      {/* 透明覆盖层确保鼠标事件在整个区域生效 */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        style={{ pointerEvents: 'all' }}
      />
    </svg>
  )
}
