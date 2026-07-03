'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  ai_generated_at: string
  created_at: string
}

export default function ViewLaporanKinerjaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [laporan, setLaporan] = useState<LaporanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchLaporan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchLaporan = async () => {
    try {
      const res = await fetch(`/api/laporan-kinerja/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data')
      }

      setLaporan(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/laporan-kinerja/${id}/download?format=${format}`)
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
      const res = await fetch(`/api/laporan-kinerja/${id}`, {
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

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error || !laporan) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error || 'Laporan tidak ditemukan'}
        </div>
        <Button onClick={() => router.back()}>Kembali</Button>
      </div>
    )
  }

  const content = laporan.content

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.back()} className="mb-2 gap-2 -ml-2">
            <span>←</span>
            <span>Kembali</span>
          </Button>
          <h1 className="text-2xl font-bold">📄 {laporan.judul}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>
              Semester {laporan.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
            </span>
            <span>•</span>
            <span>{content?.identitas?.sekolah || 'Sekolah'}</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                laporan.status === 'final'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              )}
            >
              {laporan.status === 'final' ? 'Final' : 'Draft'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
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
      </div>

      {content ? (
        <div className="space-y-8">
          {content.identitas && (
            <div className="bg-muted/50 rounded-xl p-6">
              <h2 className="font-semibold mb-4">Identitas Guru</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nama:</span>
                  <span className="ml-2 font-medium">{content.identitas.nama}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mata Pelajaran:</span>
                  <span className="ml-2">{content.identitas.mata_pelajaran}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kelas:</span>
                  <span className="ml-2">{content.identitas.kelas}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Periode:</span>
                  <span className="ml-2">{content.identitas.periode}</span>
                </div>
              </div>
            </div>
          )}

          {content.sections?.map((section, index) => (
            <section key={index}>
              <h2 className="text-lg font-semibold mb-3">{section.heading}</h2>
              <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}

          {content.ringkasan_singkat && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <h3 className="font-medium text-violet-800 mb-2">📌 Ringkasan</h3>
              <p className="text-violet-700">{content.ringkasan_singkat}</p>
            </div>
          )}
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
