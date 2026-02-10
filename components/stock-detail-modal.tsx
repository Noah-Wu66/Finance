'use client'

import { useEffect } from 'react'

import { StockDataPanel } from '@/components/stock-data-panel'

interface StockDetailModalProps {
  symbol: string
  name: string
  market: string
  open: boolean
  onClose: () => void
}

export function StockDetailModal({ symbol, name, market, open, onClose }: StockDetailModalProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-[var(--overlay)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="
            pointer-events-auto w-full max-w-none sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto
            bg-[var(--card-bg)] border border-[var(--border)]
            rounded-none sm:rounded-2xl shadow-[var(--card-shadow-lg)]
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="
            sticky top-0 z-10
            flex items-center justify-between gap-4
            px-4 sm:px-6 py-3.5 sm:py-4
            border-b border-[var(--border)]
            bg-[var(--card-bg)]
            rounded-t-none sm:rounded-t-2xl
          ">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-semibold text-[var(--fg)] m-0 truncate">
                    {name}
                  </h2>
                  <span className="
                    text-[11px] px-1.5 py-0.5 rounded
                    bg-[var(--bg-secondary)] text-[var(--fg-muted)]
                    shrink-0
                  ">
                    {market}
                  </span>
                </div>
                <p className="text-xs font-mono text-[var(--fg-muted)] m-0 mt-0.5">{symbol}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="
                shrink-0 flex items-center justify-center
                w-8 h-8 rounded-lg
                text-[var(--fg-muted)]
                hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]
                transition-colors cursor-pointer
              "
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content - 使用可复用组件 */}
           <div className="p-4 sm:p-6">
            <StockDataPanel symbol={symbol} />
          </div>
        </div>
      </div>
    </>
  )
}
