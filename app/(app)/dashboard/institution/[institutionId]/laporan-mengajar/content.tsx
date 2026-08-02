'use client'
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardParams } from "../../../_shared/params-context"
import { Button, Card, Badge, Spinner } from "@/app/components/ui"

interface ReportEntry {
  id: string
  tanggal: string
  guru_nama: string
  kelas: string
  mapel: string
  sekolah: string
  materi: string
  status: string
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

export default function InstitutionLaporanMengajarPage() {
  const params = useDashboardParams()
  const router = useRouter()
  const institutionId = params.institutionId as string
  const [filter, setFilter] = useState('month')
  const [guruFilter, setGuruFilter] = useState('')
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    try {
      const url = new URL(`/api/institution/${institutionId}/laporan-mengajar`, window.location.origin)
      url.searchParams.set('period', filter)
      if (guruFilter) url.searchParams.set('guru_id', guruFilter)
      url.searchParams.set('page', String(page))
      const res = await apiFetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch institution laporan mengajar:', err)
    } finally {
      setLoading(false)
    }
  }, [institutionId, filter, guruFilter, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Group by guru
  const grouped = reports.reduce((acc, report) => {
    const key = report.guru_nama
    if (!acc[key]) acc[key] = []
    acc[key].push(report)
    return acc
  }, {} as Record<string, ReportEntry[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Laporan Mengajar Guru</h1>
        <p className="text-sm text-slate-500 mt-1">
          Laporan administrasi mengajar dari seluruh guru di institusi ini
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Laporan</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{Object.keys(grouped).length}</p>
          <p className="text-xs text-slate-500 mt-1">Guru Aktif</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">
            {reports.filter(r => r.status === 'Final').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Sudah Final</p>
        </Card>
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
            Belum ada laporan mengajar dari guru di institusi ini.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([guruNama, guruReports]) => (
            <Card key={guruNama} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-600">
                      {guruNama.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{guruNama}</h3>
                    <p className="text-xs text-slate-400">{guruReports.length} laporan</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {guruReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={report.status === 'Final' ? 'green' : 'yellow'} size="sm">
                          {report.status}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {formatDate(report.tanggal)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        {report.mapel} • Kelas {report.kelas}
                      </p>
                      {report.materi && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {report.materi}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/institution/${institutionId}/laporan-mengajar/${report.id}`)}
                      >
                        Detail
                      </Button>
                      {report.pdf_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/institution/${institutionId}/laporan-mengajar/${report.id}/download?format=pdf`, '_blank')}
                        >
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ←
              </Button>
              <span className="text-sm text-slate-500 px-3">Halaman {page} dari {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
