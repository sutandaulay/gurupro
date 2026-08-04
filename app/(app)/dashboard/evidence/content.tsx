'use client'
import { apiFetch } from "@/lib/api-client";
import { Pagination, usePagedItems } from "@/components/ui/pagination";

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

interface EvidenceScore {
  kode: string
  nama: string
  komponen: string
  persen: number
  status: 'ok' | 'warning' | 'critical'
  jumlah_evidence: number
  min_evidence: number
}

interface MissingItem {
  jenis: string
  deskripsi: string
  action_label: string
  action_url: string
  urgensi: 'tinggi' | 'sedang' | 'rendah'
}

interface EvidenceSummary {
  stat_cards: {
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
  indikator_score: EvidenceScore[]
  missing_evidence: MissingItem[]
  siap_laporan: boolean
}

export default function EvidenceDashboardPage() {
  const { activeSchoolId } = useActiveSchool()
  const [data, setData] = useState<EvidenceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedKomponen, setSelectedKomponen] = useState<string>('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const tahunAjaranId = localStorage.getItem('tahunAjaranId') || ''
      const semester = localStorage.getItem('semester') || ''

      const params = new URLSearchParams()
      if (tahunAjaranId) params.set('tahun_ajaran_id', tahunAjaranId)
      if (semester) params.set('semester', semester)
      if (activeSchoolId) params.set('sekolah_id', activeSchoolId)

      const url = `/api/evidence/summary?${params.toString()}`

      const res = await apiFetch(url)
      const json = await res.json()

      if (res.ok) {
        setData(json)
      } else {
        setError(json.error || 'Gagal mengambil data')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengambil data')
    } finally {
      setLoading(false)
    }
  }

  const groupedIndicators = data?.indikator_score.reduce((acc, ik) => {
    if (!acc[ik.komponen]) {
      acc[ik.komponen] = []
    }
    acc[ik.komponen].push(ik)
    return acc
  }, {} as Record<string, EvidenceScore[]>) || {}

  const komponenLabels: Record<string, string> = {
    perencanaan: '📋 Perencanaan',
    pelaksanaan: '📚 Pelaksanaan',
    penilaian: '✅ Penilaian',
    tindak_lanjut: '🔄 Tindak Lanjut',
    refleksi: '💭 Refleksi',
    kolaborasi: '🤝 Kolaborasi',
    pengembangan_diri: '🎓 Pengembangan Diri',
    inovasi: '💡 Inovasi',
  }

  const filteredIndicators = selectedKomponen
    ? data?.indikator_score.filter(ik => ik.komponen === selectedKomponen)
    : data?.indikator_score

  const indicatorsPager = usePagedItems(filteredIndicators || [], 25)
  const missingPager = usePagedItems(data?.missing_evidence || [], 25)

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Button onClick={fetchSummary} className="mt-4">
          Coba Lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📊 Dashboard Kinerja Saya</h1>
        <p className="text-muted-foreground mt-1">
          Pantau evidence kerja Anda untuk laporan kinerja
        </p>
      </div>

      {data && (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
              <div className="text-2xl font-bold">{data.stat_cards.total_pembelajaran}</div>
              <div className="text-xs text-muted-foreground">Pertemuan</div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="text-2xl font-bold">{data.stat_cards.total_journal}</div>
              <div className="text-xs text-muted-foreground">Jurnal</div>
            </div>
            <div className="p-3 rounded-xl bg-green-50 border border-green-100">
              <div className="text-2xl font-bold">{data.stat_cards.total_modul_ajar}</div>
              <div className="text-xs text-muted-foreground">Modul Ajar</div>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
              <div className="text-2xl font-bold">{data.stat_cards.total_penilaian}</div>
              <div className="text-xs text-muted-foreground">Asesmen</div>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Evidence Score per Indikator</h2>
          <Link href="/dashboard/laporan-kinerja/buat">
            <Button size="sm" className="gap-2">
              <span>📄</span>
              <span>Buat Laporan</span>
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedKomponen('')}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              selectedKomponen === ''
                ? 'bg-violet-100 text-violet-700'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            Semua
          </button>
          {Object.keys(groupedIndicators).map(kom => (
            <button
              key={kom}
              onClick={() => setSelectedKomponen(kom)}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                selectedKomponen === kom
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {komponenLabels[kom] || kom}
            </button>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-4">
          {indicatorsPager.pagedItems.map(ik => (
            <div key={ik.kode} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ik.nama}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700 ease-out',
                        ik.status === 'ok' ? 'bg-violet-600' : ik.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${Math.min(100, ik.persen)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className={cn(
                'text-sm font-semibold tabular-nums',
                ik.status === 'ok' ? 'text-violet-600' : ik.status === 'warning' ? 'text-amber-600' : 'text-red-600'
              )}>
                {ik.persen}%
              </div>
              <div className="text-xs text-muted-foreground">
                {ik.jumlah_evidence}/{ik.min_evidence}
              </div>
            </div>
          ))}
          {indicatorsPager.total > 0 && (
            <Pagination
              page={indicatorsPager.page}
              pageSize={indicatorsPager.pageSize}
              total={indicatorsPager.total}
              totalPages={indicatorsPager.totalPages}
              onPageChange={(p) => indicatorsPager.reset(p)}
              onPageSizeChange={(s) => { indicatorsPager.setPageSize(s); indicatorsPager.reset(1) }}
            />
          )}
        </div>
      </section>

      {data?.missing_evidence && data.missing_evidence.length > 0 && (
        <section className="mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-medium text-amber-800">
                {data.missing_evidence.length} bukti perlu dilengkapi
              </p>
            </div>
            {missingPager.pagedItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-amber-100/50">
                <p className="text-sm text-amber-700 truncate">{item.deskripsi}</p>
                <Link href={item.action_url}>
                  <Button size="sm" variant="secondary" className="shrink-0 text-xs">
                    {item.action_label}
                  </Button>
                </Link>
              </div>
            ))}
            {missingPager.total > 0 && (
              <Pagination
                page={missingPager.page}
                pageSize={missingPager.pageSize}
                total={missingPager.total}
                totalPages={missingPager.totalPages}
                onPageChange={(p) => missingPager.reset(p)}
                onPageSizeChange={(s) => { missingPager.setPageSize(s); missingPager.reset(1) }}
              />
            )}
          </div>
        </section>
      )}

      <section className="pt-4 border-t">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.siap_laporan
              ? '✅ Semua indikator terpenuhi. Laporan siap dibuat.'
              : '⚠ Lengkapi evidence di atas untuk laporan yang optimal.'}
          </p>
          <Link href="/dashboard/laporan-kinerja/buat">
            <Button size="lg" className="gap-2">
              <span>🤖</span>
              <span>Generate Laporan Kinerja</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
