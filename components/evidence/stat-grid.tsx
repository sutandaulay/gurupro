'use client'

import { cn } from '@/lib/utils'

interface StatCards {
  total_pembelajaran: number
  total_modul_ajar: number
  total_penilaian: number
  total_remedial: number
  total_pelatihan: number
  total_jam_pelatihan: number
  total_komunikasi_ortu: number
  total_refleksi: number
  total_journal: number
  pelatihan_belum_sertifikat: number
}

interface StatGridProps {
  data: StatCards
}

interface StatCardItemProps {
  label: string
  value: number | string
  suffix?: string
  icon: string
  color?: 'violet' | 'blue' | 'green' | 'amber' | 'red'
}

function StatCardItem({ label, value, suffix, icon, color = 'violet' }: StatCardItemProps) {
  const colorClasses = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  }[color]

  return (
    <div className={cn('p-3 rounded-xl border transition-all hover:shadow-sm', colorClasses)}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {value}
            {suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
          </div>
          <div className="text-xs opacity-80">{label}</div>
        </div>
      </div>
    </div>
  )
}

export function StatGrid({ data }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCardItem
        label="Pertemuan"
        value={data.total_pembelajaran}
        icon="📚"
        color="violet"
      />
      <StatCardItem
        label="Jurnal"
        value={data.total_journal}
        icon="📝"
        color="blue"
      />
      <StatCardItem
        label="Modul Ajar"
        value={data.total_modul_ajar}
        icon="📋"
        color="green"
      />
      <StatCardItem
        label="Asesmen"
        value={data.total_penilaian}
        icon="✅"
        color="violet"
      />
      <StatCardItem
        label="Remedial"
        value={data.total_remedial}
        icon="🔄"
        color="amber"
      />
      <StatCardItem
        label="Pelatihan"
        value={data.total_pelatihan}
        icon="🎓"
        color="blue"
      />
      <StatCardItem
        label="Jam Pelatihan"
        value={data.total_jam_pelatihan}
        suffix="jam"
        icon="⏱️"
        color="green"
      />
      <StatCardItem
        label="Refleksi"
        value={data.total_refleksi}
        icon="💭"
        color="violet"
      />
    </div>
  )
}

// Summary cards for header
export function StatSummaryCards({ data }: { data: StatCards }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📚</span>
        <div>
          <div className="text-xl font-bold">{data.total_pembelajaran}</div>
          <div className="text-xs text-muted-foreground">Pertemuan</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎓</span>
        <div>
          <div className="text-xl font-bold">{data.total_pelatihan}</div>
          <div className="text-xs text-muted-foreground">Pelatihan</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl">⏱️</span>
        <div>
          <div className="text-xl font-bold">{data.total_jam_pelatihan}</div>
          <div className="text-xs text-muted-foreground">Jam</div>
        </div>
      </div>
      {data.pelatihan_belum_sertifikat > 0 && (
        <div className="flex items-center gap-2 text-amber-600">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-xl font-bold">{data.pelatihan_belum_sertifikat}</div>
            <div className="text-xs">Belum upload sertifikat</div>
          </div>
        </div>
      )}
    </div>
  )
}
