'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Badge, Spinner } from '@/app/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

interface ReportEntry {
  id: string
  mapel: string
  kelas: string
  materi: string
  status: string
}

interface DailyReport {
  tanggal: string
  hari: string
  total_mengajar: number
  mapel: string[]
  kelas: string[]
  entries: ReportEntry[]
}

interface Summary {
  total_hari: number
  total_mengajar: number
  start_date: string
  end_date: string
}

const FILTERS = [
  { id: 'hari_ini', label: 'Hari Ini' },
  { id: 'kemarin', label: 'Kemarin' },
  { id: 'minggu_ini', label: 'Minggu Ini' },
  { id: 'bulan_ini', label: 'Bulan Ini' },
]

export default function LaporanHarianPage() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  const [filter, setFilter] = useState('hari_ini')
  const [selectedDate, setSelectedDate] = useState('')
  const [reports, setReports] = useState<DailyReport[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedDate) {
      params.set('tanggal', selectedDate)
    } else {
      params.set('filter', filter)
    }
    if (activeSchoolId) params.set('sekolah_id', activeSchoolId)
    params.set('page', String(page))
    params.set('limit', String(pageSize))
    return `/api/laporan-harian?${params.toString()}`
  }, [filter, selectedDate, activeSchoolId, page, pageSize])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(buildUrl())
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
        setSummary(data.summary || null)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.totalRecords || data.reports?.length || 0)
      }
    } catch (err) {
      console.error('Failed to fetch daily reports:', err)
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFilterClick = (id: string) => {
    setFilter(id)
    setSelectedDate('')
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSelectedDate(val)
    if (val) setFilter('')
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Harian</h1>
          <p className="text-sm text-slate-500 mt-1">
            Rekap aktivitas mengajar per hari — siap cetak sebagai dokumen resmi (berisi ringkasan kehadiran & tanda tangan)
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/dashboard/laporan-mengajar')}
          className="whitespace-nowrap"
        >
          Arsip Jurnal Mengajar →
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => handleFilterClick(f.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all',
              filter === f.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-slate-400">|</span>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className={cn(
              'px-3 py-2 rounded-xl text-sm font-bold border transition-all',
              selectedDate
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 border-slate-200'
            )}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summary && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Total Hari</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{summary.total_hari}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Total Mengajar</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.total_mengajar}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Rata-rata/Hari</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {summary.total_hari > 0
                ? (summary.total_mengajar / summary.total_hari).toFixed(1)
                : 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Periode</p>
            <p className="text-xs font-semibold text-slate-700 mt-1">
              {summary.start_date} — {summary.end_date}
            </p>
          </Card>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-600 font-medium">Belum ada laporan harian</p>
          <p className="text-sm text-slate-400 mt-1">
            Selesaikan sesi mengajar untuk mulai mencatat laporan harian
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card
              key={report.tanggal}
              onClick={() => {
                const params = new URLSearchParams()
                if (activeSchoolId) params.set('sekolah_id', activeSchoolId)
                const qs = params.toString()
                router.push(`/dashboard/laporan-harian/${report.tanggal}${qs ? `?${qs}` : ''}`)
              }}
              className="p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800">{report.hari}</h3>
                  <p className="text-sm text-slate-500">
                    {new Date(report.tanggal).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Badge variant="info">{report.total_mengajar} sesi</Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Mapel: </span>
                  <span className="font-medium text-slate-700">
                    {report.mapel.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Kelas: </span>
                  <span className="font-medium text-slate-700">
                    {report.kelas.join(', ')}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {report.entries.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xs text-slate-500 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="font-medium text-slate-600">
                      {entry.mapel}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="truncate">{entry.materi}</span>
                  </div>
                ))}
                {report.entries.length > 3 && (
                  <p className="text-xs text-indigo-500 font-medium mt-1">
                    +{report.entries.length - 3} sesi lainnya
                  </p>
                )}
              </div>
            </Card>
          ))}

          {total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={() => {}}
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  )
}
