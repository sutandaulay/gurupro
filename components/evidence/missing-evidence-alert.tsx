'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'

interface MissingItem {
  jenis: string
  deskripsi: string
  action_label: string
  action_url: string
  urgensi: 'tinggi' | 'sedang' | 'rendah'
}

interface MissingEvidenceAlertProps {
  items: MissingItem[]
}

export function MissingEvidenceAlert({ items }: MissingEvidenceAlertProps) {
  if (!items || items.length === 0) return null

  const tinggi = items.filter(i => i.urgensi === 'tinggi')
  const lainnya = items.filter(i => i.urgensi !== 'tinggi')
  const sortedItems = [...tinggi, ...lainnya]

  return (
    <div className={cn(
      'rounded-xl p-4 space-y-3',
      'bg-amber-50 border border-amber-200'
    )}>
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <p className="text-sm font-medium text-amber-800">
          {items.length} bukti perlu dilengkapi untuk laporan kinerja optimal
        </p>
      </div>

      <div className="space-y-2">
        {sortedItems.map((item, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-between gap-4 p-2 rounded-lg',
              item.urgensi === 'tinggi' ? 'bg-amber-100/50' : 'bg-white/50'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.urgensi === 'tinggi' && (
                <span className="text-red-500 text-sm">🔴</span>
              )}
              <p className="text-sm text-amber-700 truncate">{item.deskripsi}</p>
            </div>
            <Link
              href={item.action_url}
              className={cn(
                'shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors',
                'bg-amber-200 text-amber-800 hover:bg-amber-300'
              )}
            >
              {item.action_label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

// Compact version for cards
export function MissingEvidenceBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <span>⚠️</span>
      <span>{count} perlu dilengkapi</span>
    </span>
  )
}
