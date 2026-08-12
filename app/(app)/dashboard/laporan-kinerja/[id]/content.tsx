'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardParams } from '../../_shared/params-context'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface LaporanSection {
  heading: string
  content: string
}

interface LaporanContent {
  identitas: {
    nama: string
    mata_pelajaran: string
    kelas: string
    sekolah: string
    periode: string
  }
  sections: LaporanSection[]
  ringkasan_singkat: string
}

interface LaporanData {
  id: string
  judul: string
  semester: string
  tahun_ajaran_id: string
  content: LaporanContent
  evidence_summary: any
  status: string
  predikat: string | null
  total_observasi: number
  rata_rata_rating: number | null
  skp_id: string | null
  ai_generated_at: string
  created_at: string
}

interface ObservasiItem {
  id: string
  tanggal_observasi: string
  jenis: string
  status: string
  suasana_pembelajaran: string | null
  catatan_observer: string | null
  rekomendasi: string | null
  indikator_ratings?: any[]
}

interface SKPData {
  id: string
  status: string
  catatan_guru: string | null
  indikator_list: any[]
  observasi: ObservasiItem[]
}

export default function ViewLaporanKinerjaPage() {
  const router = useRouter()
  const params = useDashboardParams()
  const id = params.id as string

  const [laporan, setLaporan] = useState<LaporanData | null>(null)
  const [skpData, setSkpData] = useState<SKPData | null>(null)
  const [observasiList, setObservasiList] = useState<ObservasiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [showPredikatForm, setShowPredikatForm] = useState(false)
  const [selectedPredikat, setSelectedPredikat] = useState('')

  const fetchLaporan = async () => {
    try {
      const res = await apiFetch(`/api/laporan-kinerja/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data')
      }

      setLaporan(data)

      // Fetch SKP and observasi related to this laporan
      if (data.skp_id) {
        const skpDetailRes = await apiFetch(`/api/skp/${data.skp_id}`)
        if (skpDetailRes.ok) {
          const skpDetail = await skpDetailRes.json()
          setSkpData(skpDetail)
          setObservasiList(skpDetail.observasi || [])
        }
      } else if (data.tahun_ajaran_id && data.semester) {
        const taId = data.tahun_ajaran_id
        const skpRes = await apiFetch(`/api/skp?tahun_ajaran_id=${taId}`)
        if (skpRes.ok) {
          const skpArr = await skpRes.json()
          if (skpArr.length > 0) {
            const skpDetailRes = await apiFetch(`/api/skp/${skpArr[0].id}`)
            if (skpDetailRes.ok) {
              const skpDetail = await skpDetailRes.json()
              setSkpData(skpDetail)
              setObservasiList(skpDetail.observasi || [])
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLaporan()
  }, [id])

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setDownloading(true)
    try {
      const res = await apiFetch(`/api/laporan-kinerja/${id}/download?format=${format}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${laporan?.judul || 'LaporanKinerja'}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleFinalize = async () => {
    try {
      const res = await apiFetch(`/api/laporan-kinerja/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'final' }),
      })

      if (res.ok) {
        setLaporan(prev => prev ? { ...prev, status: 'final' } : null)
      }
    } catch (err) {
      console.error('Finalize failed:', err)
    }
  }

  const handleSetPredikat = async () => {
    if (!selectedPredikat) return

    const avgRating = observasiList.length > 0
      ? observasiList.reduce((s, o) => {
          const ratings = o.indikator_ratings || []
          if (ratings.length === 0) return s
          const sum = ratings.reduce((rs, r) => rs + (Number(r.rating) || 0), 0)
          return s + (sum / ratings.length)
        }, 0) / observasiList.length
      : null

    try {
      const res = await apiFetch(`/api/laporan-kinerja/${id}/predikat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predikat: selectedPredikat,
          rataRataRating: avgRating ? Math.round(avgRating * 100) / 100 : null,
          totalObservasi: observasiList.length,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setLaporan(prev => prev ? {
          ...prev,
          predikat: data.predikat,
          rata_rata_rating: data.rata_rata_rating,
          total_observasi: data.total_observasi,
          status: 'final',
        } : null)
        setShowPredikatForm(false)
      }
    } catch (err) {
      console.error('Set predikat failed:', err)
    }
  }

  const ratingColor = (val: number) => {
    const idx = Math.max(0, Math.min(4, Math.round(val) || 0))
    const colors = ['bg-gray-300', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-green-500']
    return colors[idx]
  }

  const ratingLabel = (val: number) => {
    const idx = Math.max(0, Math.min(4, Math.round(val) || 0))
    const labels = ['', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik']
    return labels[idx] || ''
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

  if (error || !laporan) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error || 'Laporan tidak ditemukan'}
        </div>
        <Button onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  const content = laporan.content

  const calculateAvgObservasiRating = () => {
    if (observasiList.length === 0) return null
    let totalRating = 0
    let totalCount = 0
    for (const obs of observasiList) {
      if (obs.indikator_ratings) {
        for (const r of obs.indikator_ratings) {
          totalRating += r.rating
          totalCount++
        }
      }
    }
    return totalCount > 0 ? (totalRating / totalCount).toFixed(1) : null
  }

  const avgObsRating = calculateAvgObservasiRating()

  const predikatScores: Record<string, { min: number; color: string; desc: string }> = {
    'Amat Baik': { min: 3.5, color: 'bg-green-100 text-green-700', desc: 'Melampaui ekspektasi' },
    'Baik': { min: 2.5, color: 'bg-blue-100 text-blue-700', desc: 'Sesuai ekspektasi' },
    'Cukup': { min: 1.5, color: 'bg-amber-100 text-amber-700', desc: 'Perlu peningkatan' },
    'Kurang': { min: 0, color: 'bg-red-100 text-red-700', desc: 'Di bawah ekspektasi' },
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/laporan-kinerja')} className="mb-2 gap-2 -ml-2">
            <span>←</span>
            <span>Kembali</span>
          </Button>
          <h1 className="text-2xl font-bold">📄 {laporan.judul}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
            <span>Semester {laporan.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</span>
            <span>•</span>
            <span>{content?.identitas?.sekolah || 'Sekolah'}</span>
            {laporan.predikat && (
              <>
                <span>•</span>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', predikatScores[laporan.predikat]?.color || 'bg-gray-100')}>
                  {laporan.predikat}
                </span>
              </>
            )}
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs',
              laporan.status === 'final'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            )}>
              {laporan.status === 'final' ? 'Final' : 'Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant="secondary" onClick={() => handleDownload('docx')} disabled={downloading} className="gap-2">
          <span>📥</span>
          <span>Download Word</span>
        </Button>
        <Button variant="secondary" onClick={() => handleDownload('pdf')} disabled={downloading} className="gap-2">
          <span>📄</span>
          <span>Download PDF</span>
        </Button>
        {laporan.status !== 'final' && (
          <Button onClick={handleFinalize} className="gap-2">
            <span>✓</span>
            <span>Finalisasi</span>
          </Button>
        )}
        {laporan.status !== 'final' && observasiList.length > 0 && (
          <Button onClick={() => { setShowPredikatForm(true); setSelectedPredikat(laporan.predikat || '') }} variant="secondary" className="gap-2">
            <span>🏆</span>
            <span>Tetapkan Predikat</span>
          </Button>
        )}
      </div>

      {/* Predikat Form Modal */}
      {showPredikatForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-lg mb-4">Tetapkan Predikat Akhir</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Berdasarkan hasil observasi dan capaian kinerja
            </p>
            {avgObsRating && (
              <p className="text-sm mb-4">
                Rata-rata rating observasi: <strong>{avgObsRating}/4</strong>
              </p>
            )}
            <div className="space-y-3 mb-6">
              {Object.entries(predikatScores).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPredikat(key)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all',
                    selectedPredikat === key
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <div className="font-medium">{key}</div>
                  <div className="text-xs text-muted-foreground">{val.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPredikatForm(false)} className="flex-1">
                Batal
              </Button>
              <Button onClick={handleSetPredikat} disabled={!selectedPredikat} className="flex-1">
                Tetapkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PKG 2026 Dashboard: Ringkasan */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{observasiList.length}</div>
          <div className="text-xs text-muted-foreground">Observasi</div>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{avgObsRating || '-'}</div>
          <div className="text-xs text-muted-foreground">Rata-rata Rating</div>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{skpData?.indikator_list?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Indikator SKP</div>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{laporan.predikat || '-'}</div>
          <div className="text-xs text-muted-foreground">Predikat</div>
        </div>
      </div>

      {content ? (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          {/* Kop dokumen */}
          <div className="px-10 pt-8 text-center">
            <div className="text-xl font-bold text-gray-900 uppercase tracking-wide leading-snug">
              {content?.identitas?.sekolah || "Laporan Kinerja"}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {content?.identitas?.periode || `Semester ${laporan.semester === 'ganjil' ? 'Ganjil' : 'Genap'}`}
            </div>
          </div>
          <div className="px-0 mt-3">
            <div className="border-b-2 border-gray-900" />
            <div className="border-b border-gray-800 mt-0.5" />
          </div>

          <div className="px-10 py-6 space-y-8">
            {/* Identitas */}
            {content.identitas && (
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  <span className="w-4 h-1 bg-violet-500 rounded-full inline-block" />
                  Identitas Guru
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="flex">
                    <span className="text-gray-500 w-36 flex-shrink-0">Nama</span>
                    <span className="font-medium text-justify">{content.identitas.nama}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-36 flex-shrink-0">Mata Pelajaran</span>
                    <span>{content.identitas.mata_pelajaran}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-36 flex-shrink-0">Kelas</span>
                    <span>{content.identitas.kelas}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-36 flex-shrink-0">Sekolah</span>
                    <span>{content.identitas.sekolah}</span>
                  </div>
                  <div className="flex col-span-2">
                    <span className="text-gray-500 w-36 flex-shrink-0">Periode</span>
                    <span>{content.identitas.periode}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ringkasan naratif */}
            {content.ringkasan_singkat && (
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  <span className="w-4 h-1 bg-violet-500 rounded-full inline-block" />
                  Ringkasan
                </h2>
                <p className="text-sm text-gray-800 leading-relaxed text-justify">
                  {content.ringkasan_singkat}
                </p>
              </div>
            )}

            {/* SKP Section */}
            {skpData && skpData.indikator_list?.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  <span className="w-4 h-1 bg-blue-500 rounded-full inline-block" />
                  Rencana SKP Tahunan
                </h2>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                  {skpData.indikator_list.map((ind: any) => (
                    <div key={ind.id} className="flex items-center justify-between text-sm px-4 py-2.5 bg-white">
                      <div className="flex gap-2">
                        <span className="font-medium">{ind.kode}</span>
                        <span className="text-gray-700">{ind.indikator_nama}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        Target: {ind.target_self} evidence
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observasi Results */}
            {observasiList.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  <span className="w-4 h-1 bg-blue-500 rounded-full inline-block" />
                  Hasil Observasi Kinerja
                </h2>
                <div className="space-y-3">
                  {observasiList.map((obs) => {
                    const ratings = obs.indikator_ratings || []
                    const obsAvg = ratings.length > 0
                      ? (ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratings.length)
                      : 0
                    return (
                      <div key={obs.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {new Date(obs.tanggal_observasi).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                              {obs.jenis === 'kelas' ? 'Observasi Kelas' : obs.jenis}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={cn('w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold', ratingColor(Math.round(obsAvg)))}>
                              {obsAvg.toFixed(1)}
                            </div>
                          </div>
                        </div>
                        {obs.indikator_ratings && (
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {obs.indikator_ratings.map((r: any) => (
                              <div key={r.id} className="flex items-center gap-1 text-xs bg-gray-50 rounded p-1.5">
                                <span className="font-medium">{r.kode}</span>
                                <span className={cn('w-4 h-4 rounded flex items-center justify-center text-white text-[10px] font-bold', ratingColor(r.rating))}>
                                  {r.rating}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {obs.suasana_pembelajaran && (
                          <p className="text-sm text-gray-600 mt-2">{obs.suasana_pembelajaran}</p>
                        )}
                        {obs.rekomendasi && (
                          <div className="mt-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <span className="font-medium text-amber-800">Rekomendasi:</span>
                            <span className="text-amber-700 ml-1">{obs.rekomendasi}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI Generated Sections */}
            {content.sections?.map((section, index) => (
              <section key={index}>
                <h2 className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  <span className="w-4 h-1 bg-violet-500 rounded-full inline-block" />
                  {section.heading}
                </h2>
                <div className="text-sm text-gray-800 leading-relaxed text-justify whitespace-pre-line">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-muted rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Konten laporan tidak tersedia</p>
        </div>
      )}

      <div className="mt-8 pt-6 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Dibuat dengan AI pada {new Date(laporan.ai_generated_at || laporan.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
