'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Pelatihan {
  id: string
  nama_pelatihan: string
  jenis: string
  lingkup: string
  durasi_jam: number
  tanggal_mulai: string
  tanggal_selesai: string
  nomor_sertifikat?: string
  status_verifikasi: string
  file_sertifikat_url?: string
}

interface Stats {
  total: number
  total_jam: number
  belum_sertifikat: number
}

const JENIS_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  seminar: 'Seminar',
  webinar: 'Webinar',
  diklat: 'Diklat',
  bimtek: 'Bimtek',
  pelatihan_mandiri: 'Pelatihan Mandiri',
  komunitas_belajar: 'Komunitas Belajar',
  studi_banding: 'Studi Banding',
  lainnya: 'Lainnya',
}

const LINGKUP_LABELS: Record<string, string> = {
  internasional: '🌍 Internasional',
  nasional: '🇮🇩 Nasional',
  provinsi: '📍 Provinsi',
  kabupaten: '📍 Kabupaten',
  sekolah: '🏫 Sekolah',
  mandiri: '📱 Mandiri',
}

export default function PengembanganDiriPage() {
  const router = useRouter()
  const [pelatihan, setPelatihan] = useState<Pelatihan[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pelatihan' | 'documents'>('pelatihan')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSemester, setSelectedSemester] = useState<string>('')

  const fetchPelatihan = async () => {
    setLoading(true)
    try {
      const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : ''
      const params = new URLSearchParams()
      if (selectedSemester) {
        params.set('semester', selectedSemester)
      }
      if (tahunAjaranId) {
        params.set('tahun_ajaran_id', tahunAjaranId)
      }

      // Fetch Pelatihan
      const res = await fetch(`/api/pelatihan?${params}`)
      const data = await res.json()

      if (res.ok) {
        setPelatihan(data.data || [])
        setStats(data.stats)
      }

      // Fetch Dokumen Bukti (Other Documents)
      const docRes = await fetch(`/api/dokumen-bukti?${params}`)
      if (docRes.ok) {
        const docData = await docRes.json()
        setDocuments(docData || [])
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load initial semester on mount to prevent SSR hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSem = localStorage.getItem('semester') || ''
      setSelectedSemester(savedSem)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPelatihan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSemester])

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pelatihan ini?')) return

    try {
      const res = await fetch(`/api/pelatihan/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPelatihan(prev => prev.filter(p => p.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📚 Pengembangan Diri & Pelatihan</h1>
        <p className="text-muted-foreground mt-1">
          Catat dan kelola pelatihan serta pengembangan kompetensi Anda
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className={cn(
          'rounded-xl p-4 mb-6',
          stats.belum_sertifikat > 0
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-green-50 border border-green-200'
        )}>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Pelatihan</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total_jam}</div>
              <div className="text-sm text-muted-foreground">Jam Total</div>
            </div>
            {stats.belum_sertifikat > 0 && (
              <div className="text-amber-600">
                <div className="text-2xl font-bold">{stats.belum_sertifikat}</div>
                <div className="text-sm">Belum upload sertifikat</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Button onClick={() => router.push('/dashboard/pengembangan-diri/tambah')} className="gap-2">
          <span>+</span>
          <span>Tambah Pelatihan</span>
        </Button>
        <Button onClick={() => router.push('/dashboard/pengembangan-diri/dokumen/tambah')} variant="secondary" className="gap-2">
          <span>📎</span>
          <span>Upload Dokumen Lain</span>
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'ganjil', 'genap'].map(sem => (
          <button
            key={sem}
            onClick={() => setSelectedSemester(sem)}
            className={cn(
              'px-3 py-1 text-sm rounded-full transition-colors',
              selectedSemester === sem
                ? 'bg-violet-100 text-violet-700'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {sem === '' ? 'Semua' : sem === 'ganjil' ? 'Ganjil' : 'Genap'}
          </button>
        ))}
      </div>

      {/* Sub-tab: Pelatihan vs Dokumen Pendukung */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('pelatihan')}
          className={cn(
            'px-4 py-2 text-sm font-bold border-b-2 -mb-[2px] transition-colors',
            activeTab === 'pelatihan'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          🎓 Daftar Pelatihan
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={cn(
            'px-4 py-2 text-sm font-bold border-b-2 -mb-[2px] transition-colors',
            activeTab === 'documents'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          📎 Dokumen Pendukung ({documents.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'pelatihan' ? (
        pelatihan.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4">🎓</div>
            <h3 className="text-lg font-medium mb-2">Belum ada pelatihan</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Catat pelatihan dan pengembangan diri Anda untuk mendukung laporan kinerja.
            </p>
            <Button onClick={() => router.push('/dashboard/pengembangan-diri/tambah')} className="gap-2">
              <span>+</span>
              <span>Tambah Pelatihan</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pelatihan.map(p => (
              <div
                key={p.id}
                className={cn(
                  'border rounded-xl p-4 transition-all hover:shadow-sm',
                  p.status_verifikasi === 'sudah_upload' || p.status_verifikasi === 'terverifikasi'
                    ? 'bg-green-50/50 border-green-200'
                    : 'bg-amber-50/50 border-amber-200'
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {p.status_verifikasi === 'terverifikasi' ? '🏆' :
                         p.status_verifikasi === 'sudah_upload' ? '📜' : '📋'}
                      </span>
                      <h3 className="font-medium truncate">{p.nama_pelatihan}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full',
                        p.status_verifikasi === 'terverifikasi' ? 'bg-green-100 text-green-700' :
                        p.status_verifikasi === 'sudah_upload' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {LINGKUP_LABELS[p.lingkup] || p.lingkup}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        {JENIS_LABELS[p.jenis] || p.jenis}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📅</span>
                    <span>{formatDate(p.tanggal_mulai)} – {formatDate(p.tanggal_selesai)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">⏱️</span>
                    <span>{p.durasi_jam} jam</span>
                  </div>
                  {p.nomor_sertifikat && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🔢</span>
                      <span className="font-mono text-xs">No. {p.nomor_sertifikat}</span>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  {p.status_verifikasi === 'sudah_upload' || p.status_verifikasi === 'terverifikasi' ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-700">
                      <span>✓</span>
                      <span>Sertifikat terupload</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <span>⚠️</span>
                      <span>Sertifikat belum diupload</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {p.status_verifikasi === 'belum_upload' && (
                    <Button onClick={() => router.push(`/dashboard/pengembangan-diri/${p.id}?action=upload`)} size="sm" variant="secondary" className="text-xs">
                      Upload Sekarang
                    </Button>
                  )}
                  <Button onClick={() => router.push(`/dashboard/pengembangan-diri/${p.id}`)} size="sm" variant="ghost" className="text-xs">
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(p.id)}
                    size="sm"
                    variant="ghost"
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        documents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4">📎</div>
            <h3 className="text-lg font-medium mb-2">Belum ada dokumen</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Unggah dokumen bukti seperti SK, Piagam, sertifikat, atau dokumen pendukung pengembangan diri lainnya.
            </p>
            <Button onClick={() => router.push('/dashboard/pengembangan-diri/dokumen/tambah')} className="gap-2">
              <span>+</span>
              <span>Upload Dokumen Lain</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="border border-slate-200 rounded-xl p-4 transition-all hover:shadow-sm flex justify-between items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-normal">📄</span>
                    <h3 className="font-bold text-slate-800 truncate">{doc.judul}</h3>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 mt-2">
                    {doc.kategori && (
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-400" style={{ width: "80px" }}>Kategori:</span>
                        <span className="capitalize">{doc.kategori}</span>
                      </div>
                    )}
                    {doc.penerbit && (
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-400" style={{ width: "80px" }}>Penerbit:</span>
                        <span>{doc.penerbit}</span>
                      </div>
                    )}
                    {doc.tanggal_dokumen && (
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-400" style={{ width: "80px" }}>Tanggal:</span>
                        <span>{formatDate(doc.tanggal_dokumen)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-100 text-violet-700 font-bold rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    Buka File
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
