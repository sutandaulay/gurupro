'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

interface SKPItem {
  id: string
  tahun_ajaran_id: string
  tahun_ajaran_nama: string
  status: string
  catatan_guru: string | null
  created_at: string
  indikator_list?: any[]
  observasi?: any[]
}

interface LaporanItem {
  id: string
  judul: string
  semester: string
  status: string
  predikat: string | null
  total_observasi: number
  rata_rata_rating: number | null
  sekolah_id: string | null
  created_at: string
  ai_generated_at: string | null
}

export default function LaporanKinerjaListPage() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  const [skpList, setSkpList] = useState<SKPItem[]>([])
  const [laporanList, setLaporanList] = useState<LaporanItem[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    try {
      const skpParams = activeSchoolId ? `?sekolah_id=${activeSchoolId}` : ''
      const lapParams = activeSchoolId ? `?sekolah_id=${activeSchoolId}` : ''

      const [skpRes, laporanRes] = await Promise.all([
        fetch(`/api/skp${skpParams}`),
        fetch(`/api/laporan-kinerja${lapParams}`),
      ])

      if (skpRes.ok) {
        const data = await skpRes.json()
        setSkpList(data)
      }

      if (laporanRes.ok) {
        const data = await laporanRes.json()
        setLaporanList(data)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeSchoolId])

  const activeSkp = skpList.find(s => s.status === 'draft' || s.status === 'submitted')

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-amber-100 text-amber-700',
      submitted: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
    }
    return map[status] || 'bg-gray-100 text-gray-700'
  }

  const predikatBadge = (predikat: string | null) => {
    if (!predikat) return null
    const map: Record<string, string> = {
      'Amat Baik': 'bg-green-100 text-green-700',
      'Baik': 'bg-blue-100 text-blue-700',
      'Cukup': 'bg-amber-100 text-amber-700',
      'Kurang': 'bg-red-100 text-red-700',
    }
    return map[predikat] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">📋 Laporan Kinerja</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => router.push('/dashboard/laporan-kinerja/buat')} className="gap-2">
            <span>+</span>
            <span>Buat Baru</span>
          </Button>
          <Button variant="secondary" onClick={() => router.push('/dashboard/laporan-kinerja/observasi')} className="gap-2">
            <span>👁️</span>
            <span>Observasi</span>
          </Button>
        </div>
      </div>

      {/* SKP Tahunan Section */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">📋 SKP Tahunan</h2>
          {!activeSkp && (
            <Button onClick={() => router.push('/dashboard/laporan-kinerja/skp')} className="gap-2 text-sm">
              <span>+</span>
              <span>Buat SKP</span>
            </Button>
          )}
        </div>

        {skpList.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-3">Belum ada SKP tahunan</p>
            <p className="text-xs text-muted-foreground mb-4">
              SKP (Sasaran Kinerja Pegawai) adalah perencanaan kinerja di awal tahun sesuai PKG 2026
            </p>
            <Button onClick={() => router.push('/dashboard/laporan-kinerja/skp')}>
              Buat SKP Sekarang
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {skpList.map((skp) => (
              <div
                key={skp.id}
                onClick={() => router.push(`/dashboard/laporan-kinerja/skp/${skp.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-medium">{skp.tahun_ajaran_nama || 'Tahun Ajaran'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Dibuat {new Date(skp.created_at).toLocaleDateString('id-ID')}
                    {skp.indikator_list && ` · ${skp.indikator_list.length} indikator`}
                    {skp.observasi && ` · ${skp.observasi.length} observasi`}
                  </div>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', statusBadge(skp.status))}>
                  {skp.status === 'draft' ? 'Draft' : skp.status === 'submitted' ? 'Disubmit' : 'Disetujui'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Laporan Tergenerate Section */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4">📄 Laporan Tergenerate</h2>

        {laporanList.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-3">Belum ada laporan yang dibuat</p>
            <p className="text-xs text-muted-foreground mb-4">
              Generate laporan kinerja setelah data mencukupi
            </p>
            <Button onClick={() => router.push('/dashboard/laporan-kinerja/buat')}>
              Generate Laporan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {laporanList.map((lap) => (
              <div
                key={lap.id}
                onClick={() => router.push(`/dashboard/laporan-kinerja/${lap.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{lap.judul}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Semester {lap.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</span>
                    <span>·</span>
                    <span>
                      {new Date(lap.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                    {lap.total_observasi > 0 && (
                      <>
                        <span>·</span>
                        <span>{lap.total_observasi} observasi</span>
                      </>
                    )}
                    {lap.rata_rata_rating && (
                      <>
                        <span>·</span>
                        <span>Rata-rata: {lap.rata_rata_rating.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lap.predikat && (
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', predikatBadge(lap.predikat))}>
                      {lap.predikat}
                    </span>
                  )}
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium',
                    lap.status === 'final' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {lap.status === 'final' ? 'Final' : 'Draft'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
