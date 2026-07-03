'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

export default function BuatLaporanKinerjaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [catatanTambahan, setCatatanTambahan] = useState('')
  const [kurikulum, setKurikulum] = useState("merdeka")

  interface StatCards {
    total_pembelajaran: number
    total_modul_ajar: number
    total_penilaian: number
    total_remedial: number
    total_pelatihan: number
    total_jam_pelatihan: number
    pelatihan_belum_sertifikat: number
  }

  interface PelatihanItem {
    id: string
    nama_pelatihan: string
    durasi_jam: number
    lingkup: string
    status_verifikasi: string
    tanggal_mulai: string
  }

  const [evidenceData, setEvidenceData] = useState<{
    stat_cards: StatCards
    pelatihan: PelatihanItem[]
    siap_laporan: boolean
  } | null>(null)

  const [formData, setFormData] = useState({
    tahunAjaranId: '',
    semester: 'ganjil' as 'ganjil' | 'genap',
  })

  useEffect(() => {
    const tahunAjaranId = localStorage.getItem('tahunAjaranId') || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(prev => ({ ...prev, tahunAjaranId }))
    // eslint-disable-next-line react-hooks/immutability
    fetchPreview()
  }, [])

  const fetchPreview = async () => {
    setLoading(true)
    try {
      const tahunAjaranId = localStorage.getItem('tahunAjaranId') || ''
      const semester = localStorage.getItem('semester') || ''

      const url = tahunAjaranId && semester
        ? `/api/evidence/summary?tahun_ajaran_id=${tahunAjaranId}&semester=${semester}`
        : `/api/evidence/summary`

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok) {
        setEvidenceData(data)
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/ai/laporan-kinerja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahunAjaranId: formData.tahunAjaranId,
          semester: formData.semester,
          catatanTambahan,
          kurikulum,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Gagal memulai generation')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.step === 'complete') {
              router.push(`/dashboard/laporan-kinerja/${data.laporan_id}`)
              return
            } else if (data.step === 'error') {
              throw new Error(data.message)
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message)
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">🤖 Generate Laporan Kinerja</h1>
      <p className="text-muted-foreground mb-6">
        AI akan menyusun laporan naratif lengkap berdasarkan evidence kerja Anda
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">📋 Evidence yang Akan Dimasukkan</h2>

        {evidenceData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{evidenceData.stat_cards.total_pembelajaran}</div>
                <div className="text-xs text-muted-foreground">Pertemuan mengajar</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{evidenceData.stat_cards.total_modul_ajar}</div>
                <div className="text-xs text-muted-foreground">Modul Ajar/RPP</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{evidenceData.stat_cards.total_penilaian}</div>
                <div className="text-xs text-muted-foreground">Asesmen</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{evidenceData.stat_cards.total_remedial}</div>
                <div className="text-xs text-muted-foreground">Remedial</div>
              </div>
            </div>

            {evidenceData.pelatihan && evidenceData.pelatihan.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  🎓 Pelatihan ({evidenceData.stat_cards.total_pelatihan} — {evidenceData.stat_cards.total_jam_pelatihan} jam)
                </h3>
                <div className="space-y-2">
                  {evidenceData.pelatihan.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center justify-between text-sm p-2 rounded-lg',
                        p.status_verifikasi === 'sudah_upload'
                          ? 'bg-green-50'
                          : 'bg-amber-50'
                      )}
                    >
                      <span className="truncate">• {p.nama_pelatihan}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.durasi_jam} jam
                        {p.status_verifikasi === 'sudah_upload' ? ' ✓' : ' ⚠️'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!evidenceData.siap_laporan && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ Beberapa indikator masih membutuhkan bukti lebih banyak.
                  Laporan tetap bisa dibuat, tapi akan ada catatan kekurangannya.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Memuat data...</p>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Catatan Tambahan (opsional)</label>
        <textarea
          value={catatanTambahan}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatanTambahan(e.target.value)}
          placeholder="Tambahkan konteks di luar aplikasi, misalnya: 'Juga membimbing tim ekstrakurikuler matematika'"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Catatan ini akan membantu AI menyusun narasi yang lebih personal
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Kurikulum</label>
        <select
          value={kurikulum}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setKurikulum(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background"
        >
          <option value="merdeka">Kurikulum Merdeka</option>
          <option value="k13">K13 (Kurikulum 2013)</option>
          <option value="kbc">KBC (Madrasah)</option>
          <option value="hybrid">Hybrid (Gabungan)</option>
        </select>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleGenerate}
          disabled={generating || !evidenceData}
          className="w-full gap-2"
          size="lg"
        >
          {generating ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>AI sedang menyusun laporan...</span>
            </>
          ) : (
            <>
              <span>🤖</span>
              <span>Generate Laporan Kinerja</span>
            </>
          )}
        </Button>

        {generating && (
          <p className="text-xs text-center text-muted-foreground">
            Biasanya selesai dalam 15-30 detik. Mohon tunggu...
          </p>
        )}
      </div>
    </div>
  )
}
