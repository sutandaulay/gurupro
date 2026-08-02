'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import { useTeacherStore } from '@/lib/stores'

interface ObservasiItem {
  id: string
  tanggal_observasi: string
  jenis: string
  status: string
  suasana_pembelajaran: string | null
  catatan_observer: string | null
  rekomendasi: string | null
  observer_nama: string | null
  created_at: string
  indikator_ratings?: any[]
}

export default function ObservasiListPage() {
  const router = useRouter()
  const { activeSchoolId } = useTeacherStore()
  const [observasiList, setObservasiList] = useState<ObservasiItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const url = activeSchoolId
        ? `/api/observasi?sekolah_id=${activeSchoolId}`
        : '/api/observasi'
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setObservasiList(data?.data ?? (Array.isArray(data) ? data : []))
      }
    } catch (err) {
      console.error('Failed to fetch observasi:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus observasi ini?')) return
    try {
      const res = await apiFetch(`/api/observasi/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setObservasiList(prev => prev.filter(o => o.id !== id))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/laporan-kinerja')} className="mb-2 gap-2 -ml-2">
            <span>←</span>
            <span>Kembali</span>
          </Button>
          <h1 className="text-2xl font-bold">👁️ Observasi Kinerja</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Observasi kelas oleh Kepala Sekolah sesuai PKG 2026
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/laporan-kinerja/observasi/buat')} className="gap-2">
          <span>+</span>
          <span>Observasi Baru</span>
        </Button>
      </div>

      {observasiList.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">👁️</div>
          <p className="text-muted-foreground mb-3">Belum ada observasi kinerja</p>
          <p className="text-xs text-muted-foreground mb-4">
            Observasi dilakukan oleh Kepala Sekolah untuk menilai praktik kinerja di kelas
          </p>
          <Button onClick={() => router.push('/dashboard/laporan-kinerja/observasi/buat')}>
            Buat Observasi
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {observasiList.map((obs) => {
            const ratingCount = obs.indikator_ratings?.length || 0
            const avgRating = obs.indikator_ratings && obs.indikator_ratings.length > 0
              ? (obs.indikator_ratings.reduce((s, r) => s + r.rating, 0) / obs.indikator_ratings.length).toFixed(1)
              : null

            return (
              <div
                key={obs.id}
                onClick={() => router.push(`/dashboard/laporan-kinerja/observasi/${obs.id}`)}
                className="border rounded-xl p-4 bg-card hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {new Date(obs.tanggal_observasi).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        {obs.jenis === 'kelas' ? 'Kelas' : obs.jenis}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {obs.observer_nama && <span>Observer: {obs.observer_nama}</span>}
                      {ratingCount > 0 && <span>{ratingCount} indikator dinilai</span>}
                      {avgRating && <span>Rata-rata: {avgRating}/4</span>}
                    </div>
                    {obs.suasana_pembelajaran && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {obs.suasana_pembelajaran}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      obs.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {obs.status === 'completed' ? 'Selesai' : 'Draft'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleHapus(obs.id) }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
