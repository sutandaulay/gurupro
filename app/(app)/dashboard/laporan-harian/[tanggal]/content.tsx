'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDashboardParams } from '../../_shared/params-context'
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

interface AttendanceSummary {
  hadir: number
  izin: number
  sakit: number
  alpha: number
  total: number
}

interface ReportDetail {
  tanggal: string
  hari: string
  tanggal_formatted: string
  total_mengajar: number
  entries: EntryDetail[]
  attendance?: AttendanceSummary | null
  guru?: { nama_lengkap: string; nip?: string }
  sekolah?: { nama_sekolah: string; nama_kepala_sekolah?: string; nip_kepala_sekolah?: string } | null
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
  const sekolah = report.sekolah?.nama_sekolah || 'GuruPRO';
  return (
    <div className="print-only print-header">
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12pt' }}>
        <tr>
          <td style={{ width: '50px', verticalAlign: 'middle' }}></td>
          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
            <h1 style={{ margin: 0, fontSize: '16pt', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>{sekolah}</h1>
            <p style={{ margin: '2pt 0', fontSize: '9pt', color: '#555' }}>Laporan Harian Guru — {report.tanggal_formatted}</p>
          </td>
          <td style={{ width: '50px', verticalAlign: 'middle' }}></td>
        </tr>
      </table>
      <hr style={{ border: '1.5px solid #000', margin: '0 0 12pt' }} />
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

function LaporanHarianDetailContent() {
  const params = useDashboardParams()
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
        const res = await apiFetch(`/api/laporan-harian/${tanggal}${apiQuery ? `?${apiQuery}` : ''}`)
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

      {/* Ringkasan Kehadiran */}
      {report.attendance && (
        <Card className="p-5 mb-4 print-card">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Ringkasan Kehadiran</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-emerald-50 rounded-xl print-cell">
              <p className="text-2xl font-bold text-emerald-600">{report.attendance.hadir}</p>
              <p className="text-xs text-emerald-500 mt-1">Hadir</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl print-cell">
              <p className="text-2xl font-bold text-amber-600">{report.attendance.izin}</p>
              <p className="text-xs text-amber-500 mt-1">Izin</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl print-cell">
              <p className="text-2xl font-bold text-blue-600">{report.attendance.sakit}</p>
              <p className="text-xs text-blue-500 mt-1">Sakit</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl print-cell">
              <p className="text-2xl font-bold text-red-600">{report.attendance.alpha}</p>
              <p className="text-xs text-red-500 mt-1">Alpha</p>
            </div>
          </div>
        </Card>
      )}

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
                    <button
                      onClick={() => router.push(`/dashboard/laporan-mengajar/${entry.id}`)}
                      className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Detail jurnal →
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Identitas & Tanda Tangan (tampil saat cetak) */}
      <div className="print-only">
        <div className="border border-black p-4 mb-6">
          <h3 className="font-bold text-sm uppercase mb-2">Identitas Guru</h3>
          <div className="text-sm space-y-1">
            <p><span className="font-semibold">Nama</span>: {report.guru?.nama_lengkap || '-'}</p>
            {report.guru?.nip && <p><span className="font-semibold">NIP</span>: {report.guru.nip}</p>}
            {report.sekolah?.nama_sekolah && (
              <p><span className="font-semibold">Sekolah</span>: {report.sekolah.nama_sekolah}</p>
            )}
            <p><span className="font-semibold">Total Sesi Mengajar</span>: {report.total_mengajar} sesi</p>
          </div>
        </div>

        <div className="mt-8">
          <table className="w-full">
            <tbody>
              <tr>
                <td className="text-center align-top w-1/2">
                  <p className="text-sm">Mengetahui,<br />Kepala Sekolah</p>
                  <div className="h-24" />
                  <p className="text-sm font-bold underline">
                    {report.sekolah?.nama_kepala_sekolah || '_____________________'}
                  </p>
                  {report.sekolah?.nip_kepala_sekolah && (
                    <p className="text-sm">NIP. {report.sekolah.nip_kepala_sekolah}</p>
                  )}
                </td>
                <td className="text-center align-top w-1/2">
                  <p className="text-sm">Guru,</p>
                  <div className="h-24" />
                  <p className="text-sm font-bold underline">
                    {report.guru?.nama_lengkap || '_____________________'}
                  </p>
                  {report.guru?.nip && <p className="text-sm">NIP. {report.guru.nip}</p>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @page {
          margin: 25mm 20mm 20mm 30mm;
          size: A4;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt;
            line-height: 1.6;
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

          .print-cell {
            border: 1px solid #ddd !important;
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
            margin: 25mm 20mm 20mm 30mm;
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

export default function LaporanHarianDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-12 h-12 text-violet-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Memuat laporan harian...</p>
        </div>
      </div>
    }>
      <LaporanHarianDetailContent />
    </Suspense>
  )
}
