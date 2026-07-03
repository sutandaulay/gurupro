'use client'

import { cn } from '@/lib/utils'

interface EvidenceScoreBarProps {
  kode: string
  nama: string
  komponen: string
  persen: number
  status: 'ok' | 'warning' | 'critical'
  jumlah_evidence: number
  min_evidence: number
}

export function EvidenceScoreBar({
  nama,
  persen,
  status,
  jumlah_evidence,
  min_evidence,
}: EvidenceScoreBarProps) {
  const barColor = {
    ok: 'bg-violet-600',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }[status]

  const textColor = {
    ok: 'text-violet-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
  }[status]

  const statusIcon = {
    ok: '✓',
    warning: '⚠',
    critical: '✗',
  }[status]

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{nama}</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
              style={{ width: `${Math.min(100, persen)}%` }}
            />
          </div>
        </div>
      </div>
      <div className={cn('text-sm font-semibold tabular-nums', textColor)}>
        {persen}%
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className={cn(status === 'ok' ? 'text-green-500' : status === 'warning' ? 'text-amber-500' : 'text-red-500')}>
          {statusIcon}
        </span>
        <span className="text-xs">
          {jumlah_evidence}/{min_evidence}
        </span>
      </div>
    </div>
  )
}

// Compact version for dashboard
export function EvidenceScoreBarCompact({
  nama,
  persen,
  status,
}: EvidenceScoreBarProps) {
  const barColor = {
    ok: 'bg-violet-600',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }[status]

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate">{nama}</span>
        <span className={cn(
          status === 'ok' ? 'text-green-600' : status === 'warning' ? 'text-amber-600' : 'text-red-600'
        )}>
          {persen}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, persen)}%` }}
        />
      </div>
    </div>
  )
}
