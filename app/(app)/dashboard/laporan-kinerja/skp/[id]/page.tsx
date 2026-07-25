'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

export default function DetailSkpPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [skp, setSkp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSkp()
  }, [id])

  const fetchSkp = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/skp/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data')
      setSkp(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/skp/${id}/submit`, { method: 'POST' })
      if (res.ok) {
        setSkp((prev: any) => ({ ...prev, status: 'submitted' }))
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Gagal submit')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleHapus = async () => {
    if (!confirm('Hapus SKP ini?')) return
    try {
      const res = await apiFetch(`/api/skp/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/laporan-kinerja')
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

  if (error || !skp) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error || 'SKP tidak ditemukan'}
        </div>
        <Button variant="ghost" onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/laporan-kinerja')} className="mb-2 gap-2 -ml-2">
            <span>←</span>
            <span>Kembali</span>
          </Button>
          <h1 className="text-2xl font-bold">📋 SKP Tahunan</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{skp.tahun_ajaran_nama || 'Tahun Ajaran'}</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                skp.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                skp.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              )}
            >
              {skp.status === 'draft' ? 'Draft' : skp.status === 'submitted' ? 'Disubmit' : 'Disetujui'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {skp.status === 'draft' && (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? 'Mengirim...' : 'Submit SKP'}
            </Button>
          )}
          <Button variant="destructive" onClick={handleHapus} className="gap-2">
            Hapus
          </Button>
        </div>
      </div>

      {/* Indikator */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">📊 Indikator Kinerja Dipilih</h2>
        <div className="space-y-3">
          {skp.indikator_list?.map((ind: any) => (
            <div key={ind.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{ind.kode}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{ind.komponen}</span>
                </div>
                <p className="text-sm mt-0.5">{ind.indikator_nama}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{ind.target_self}</div>
                <div className="text-xs text-muted-foreground">target</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Observasi Terkait */}
      {skp.observasi && skp.observasi.length > 0 && (
        <div className="bg-card border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">👁️ Observasi Terkait</h2>
          <div className="space-y-3">
            {skp.observasi.map((obs: any) => (
              <div
                key={obs.id}
                onClick={() => router.push(`/dashboard/laporan-kinerja/observasi/${obs.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer"
              >
                <div>
                  <span className="font-medium text-sm">
                    {new Date(obs.tanggal_observasi).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">({obs.jenis})</span>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  obs.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {obs.status === 'completed' ? 'Selesai' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catatan */}
      {skp.catatan_guru && (
        <div className="bg-card border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">📝 Catatan Guru</h2>
          <p className="text-muted-foreground whitespace-pre-line">{skp.catatan_guru}</p>
        </div>
      )}

      {skp.catatan_kepsek && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">🏫 Catatan Kepala Sekolah</h2>
          <p className="text-blue-700 whitespace-pre-line">{skp.catatan_kepsek}</p>
        </div>
      )}
    </div>
  )
}
