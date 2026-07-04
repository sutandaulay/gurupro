'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Card, Badge, Spinner } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface EntryDetail {
  id: string
  jam_mulai: string
  jam_selesai: string
  mapel: string
  kelas: string
  materi_pembelajaran: string
  tujuan_pembelajaran: string
  aktivitas_pembelajaran: string
  media_pembelajaran: string | null
  asesmen_pembelajaran: string | null
  refleksi_guru: string | null
  tindak_lanjut: string | null
  status: string
  auto_generated: boolean | null
}

interface ReportDetail {
  tanggal: string
  hari: string
  tanggal_formatted: string
  total_mengajar: number
  entries: EntryDetail[]
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    </div>
  )
}

function PrintHeader({ report }: { report: ReportDetail }) {
  return (
    <div className="print-only print-header">
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-xl font-bold uppercase">Laporan Harian Guru</h1>
        <p className="text-sm mt-1">{report.tanggal_formatted}</p>
        <p className="text-sm capitalize">{report.hari}</p>
      </div>
    </div>
  )
}

function PrintFooter() {
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <div className="print-only print-footer">
      <div className="border-t border-black pt-2 mt-8 text-xs text-center text-slate-500">
        <p>Dicetak pada {today}</p>
        <p className="mt-1">© GuruPRO — Laporan Harian Guru</p>
      </div>
    </div>
  )
}

export default function LaporanHarianDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement>(null)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  const handlePrint = () => {
    window.print()
  }

  const tanggal = params.tanggal as string
  const sekolahId = searchParams.get('sekolah_id') || ''

  const apiParams = new URLSearchParams()
  if (sekolahId) apiParams.set('sekolah_id', sekolahId)
  const apiQuery = apiParams.toString()

  const backUrl = `/dashboard/laporan-harian${sekolahId ? `?sekolah_id=${sekolahId}` : ''}`
  const wordUrl = `/api/laporan-harian/${tanggal}/download${apiQuery ? `?${apiQuery}` : ''}`

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true)
      try {
        const res = await fetch(`/api/laporan-harian/${tanggal}${apiQuery ? `?${apiQuery}` : ''}`)
        if (res.ok) {
          const data = await res.json()
          setReport(data)
        }
      } catch (err) {
        console.error('Failed to fetch report detail:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [tanggal, apiQuery])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-600 font-medium">Laporan tidak ditemukan</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push(backUrl)}
          >
            Kembali
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Print-only header/footer */}
      <PrintHeader report={report} />
      <PrintFooter />

      {/* Back button & Header */}
      <div className="mb-6 no-print">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push(backUrl)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(wordUrl, '_blank')}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Word
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              }
            >
              Cetak / PDF
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{report.hari}</h1>
            <p className="text-sm text-slate-500">{report.tanggal_formatted}</p>
          </div>
          <Badge variant="info" className="ml-auto">
            {report.total_mengajar} sesi mengajar
          </Badge>
        </div>
      </div>

      {/* Entries */}
      <div ref={printRef} className="space-y-4 print-content">
        {report.entries.map((entry, idx) => {
          const isExpanded = expandedIndex === idx
          return (
            <Card key={entry.id} className="overflow-hidden print-card">
              {/* Entry Header */}
              <div className="w-full p-5 flex items-center justify-between text-left no-print-hover">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">
                      {entry.mapel}
                    </div>
                    <div className="text-sm text-slate-500">
                      {entry.kelas} • {entry.jam_mulai} - {entry.jam_selesai}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                      {entry.materi_pembelajaran}
                    </p>
                  </div>
                </div>

                {/* Expand/collapse button (screen only) */}
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="no-print"
                >
                  <svg
                    className={cn(
                      'w-5 h-5 text-slate-400 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Content - always visible in print, toggleable on screen */}
              <div className={cn(!isExpanded && 'hidden', 'print-show')}>
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-5">
                  <InfoRow label="Materi Pembelajaran" value={entry.materi_pembelajaran} />
                  <InfoRow label="Tujuan Pembelajaran" value={entry.tujuan_pembelajaran} />
                  <InfoRow label="Aktivitas Pembelajaran" value={entry.aktivitas_pembelajaran} />
                  <InfoRow label="Media Pembelajaran" value={entry.media_pembelajaran} />
                  <InfoRow label="Asesmen Pembelajaran" value={entry.asesmen_pembelajaran} />
                  <InfoRow label="Refleksi Guru" value={entry.refleksi_guru} />
                  <InfoRow label="Tindak Lanjut" value={entry.tindak_lanjut} />

                  <div className="flex items-center gap-2 pt-2 no-print">
                    {entry.auto_generated && (
                      <Badge variant="info">AI Generated</Badge>
                    )}
                    <Badge
                      variant={
                        entry.status === 'Completed' ? 'success' :
                        entry.status === 'Draft' ? 'warning' : 'default'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 12pt;
            margin: 0;
            padding: 0;
          }

          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-hide { display: none !important; }
          .print-show { display: block !important; }

          .print-header { display: block !important; }
          .print-footer { display: block !important; }

          .print-card {
            break-inside: avoid;
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            border-radius: 4px !important;
            margin-bottom: 12pt !important;
          }

          .print-card .w-10.h-10 {
            background: #4f46e5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-content {
            max-width: 100% !important;
          }

          .no-print-hover:hover {
            background: transparent !important;
          }

          @page {
            margin: 2cm 1.5cm;
          }
        }

        @media screen {
          .print-only { display: none !important; }
          .print-show.print-only { display: none !important; }
        }
      `}</style>
    </div>
  )
}
