'use client'
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Badge, Spinner } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface ReportEntry {
  id: string
  tanggal: string
  kelas: string
  mapel: string
  sekolah: string
  materi: string
  status: string
  attendance: {
    hadir: number
    izin: number
    sakit: number
    alpha: number
    total: number
  } | null
  pdf_url: string | null
  docx_url: string | null
}

const FILTERS = [
  { id: 'today', label: 'Hari Ini' },
  { id: 'week', label: 'Minggu Ini' },
  { id: 'month', label: 'Bulan Ini' },
  { id: 'all', label: 'Semua' },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export default function LaporanMengajarPage() {
  const router = useRouter()
  const [filter, setFilter] = useState('month')
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/laporan-mengajar?period=${filter}&page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch laporan mengajar:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const downloadPdf = (id: string, tanggal: string) => {
    window.open(`/api/laporan-mengajar/${id}/download?format=pdf`, '_blank')
  }

  const downloadDoc = (id: string) => {
    window.open(`/api/laporan-mengajar/${id}/download?format=docx`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Mengajar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Arsip jurnal mengajar per sesi — lengkap dengan kehadiran siswa & unduhan dokumen
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {total > 0 ? `${total} laporan ditemukan` : 'Belum ada laporan'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.id}
            variant={filter === f.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { setFilter(f.id); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Report List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-slate-400 mb-3">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Belum Ada Laporan</h3>
          <p className="text-sm text-slate-400">
            Selesaikan administrasi mengajar terlebih dahulu untuk melihat laporan.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <Card key={report.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Badge variant={report.status === 'Final' ? 'green' : 'yellow'}>
                      {report.status}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {formatDate(report.tanggal)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    {report.mapel}
                  </h3>
                  <p className="text-sm text-slate-500 mb-2">
                    Kelas {report.kelas} {report.sekolah !== '-' ? `• ${report.sekolah}` : ''}
                  </p>
                  {report.materi && (
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {report.materi}
                    </p>
                  )}
                  {report.attendance && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Hadir {report.attendance.hadir}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Izin {report.attendance.izin}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Sakit {report.attendance.sakit}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        Alpha {report.attendance.alpha}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/laporan-mengajar/${report.id}`)}
                  >
                    Detail
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadPdf(report.id, report.tanggal)}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDoc(report.id)}
                  >
                    DOCX
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ←
              </Button>
              <span className="text-sm text-slate-500 px-3">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
