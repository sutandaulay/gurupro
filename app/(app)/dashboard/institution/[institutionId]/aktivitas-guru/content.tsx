'use client'
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
// useDashboardParams import removed — now uses useParams directly for Pathway B compatibility
import { Button, Card, Badge, Spinner } from "@/app/components/ui"
import { Pagination } from "@/components/ui/pagination"

interface GuruAktivitas {
  guru_id: string
  guru_nama: string
  guru_email: string | null
  role: string
  total_jurnal: number
  jurnal_final: number
  jurnal_draft: number
  jurnal_terakhir: string | null
  total_hari: number
  hadir: number
  telat: number
  sakit: number
  izin: number
  alpa: number
  cuti: number
  total_menit: number
  total_sesi: number
  skor: number
}

const FILTERS = [
  { id: 'today', label: 'Hari Ini' },
  { id: 'week', label: 'Minggu Ini' },
  { id: 'month', label: 'Bulan Ini' },
  { id: 'semester', label: 'Semester Ini' },
  { id: 'all', label: 'Semua' },
]

function formatMenit(minutes: number): string {
  if (minutes <= 0) return '0'
  const jam = Math.floor(minutes / 60)
  const mnt = minutes % 60
  if (jam === 0) return `${mnt} mnt`
  if (mnt === 0) return `${jam} jam`
  return `${jam}j ${mnt}m`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export default function InstitutionAktivitasGuruPage() {
  const params = useParams()
  const router = useRouter()
  const institutionId = params.institutionId as string
  const [filter, setFilter] = useState('month')
  const [gurus, setGurus] = useState<GuruAktivitas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const fetchData = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    setError('')
    try {
      const url = new URL(`/api/institution/${institutionId}/aktivitas-guru`, window.location.origin)
      url.searchParams.set('period', filter)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(pageSize))
      const res = await apiFetch(url.toString())
      if (res.status === 403) {
        setError('Anda tidak memiliki akses ke data ini.')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setGurus(data.gurus || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      } else {
        setError('Gagal memuat data')
      }
    } catch (err) {
      console.error('Failed to fetch aktivitas guru:', err)
      setError('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [institutionId, filter, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalJurnal = gurus.reduce((s, g) => s + g.total_jurnal, 0)
  const totalFinal = gurus.reduce((s, g) => s + g.jurnal_final, 0)
  const totalMenit = gurus.reduce((s, g) => s + g.total_menit, 0)
  const totalSesi = gurus.reduce((s, g) => s + g.total_sesi, 0)
  const totalTelat = gurus.reduce((s, g) => s + g.telat, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aktivitas Guru</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rekap aktivitas seluruh guru di institusi ini — untuk bahan pengambilan keputusan.
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{gurus.length}</p>
          <p className="text-xs text-slate-500 mt-1">Guru Aktif</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{totalJurnal}</p>
          <p className="text-xs text-slate-500 mt-1">Total Jurnal</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{totalFinal}</p>
          <p className="text-xs text-slate-500 mt-1">Jurnal Final</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{formatMenit(totalMenit)}</p>
          <p className="text-xs text-slate-500 mt-1">Menit Mengajar</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-rose-600">{totalTelat}</p>
          <p className="text-xs text-slate-500 mt-1">Hari Telat</p>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-10 text-center text-rose-600 text-sm">{error}</Card>
      ) : gurus.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-400 mb-1">Belum ada data aktivitas guru.</p>
          <p className="text-sm text-slate-400">Coba ubah rentang periode di atas.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold">Guru</th>
                  <th className="px-4 py-3 font-semibold text-center">Jurnal</th>
                  <th className="px-4 py-3 font-semibold text-center">Final</th>
                  <th className="px-4 py-3 font-semibold text-center">Kehadiran</th>
                  <th className="px-4 py-3 font-semibold text-center">Sesi</th>
                  <th className="px-4 py-3 font-semibold text-center">Menit</th>
                  <th className="px-4 py-3 font-semibold text-center">Jurnal Terakhir</th>
                  <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gurus.map((g, idx) => (
                  <tr key={g.guru_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{g.guru_nama}</p>
                          {g.guru_email && (
                            <p className="text-xs text-slate-400 truncate">{g.guru_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="info">{g.total_jurnal}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {g.jurnal_final > 0 ? (
                        <Badge variant="success">{g.jurnal_final}</Badge>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="text-emerald-600 font-semibold">{g.hadir}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-amber-600 font-semibold">{g.telat}</span>
                        {g.alpa > 0 && (
                          <>
                            <span className="text-slate-400">/</span>
                            <span className="text-rose-600 font-semibold">{g.alpa}</span>
                          </>
                        )}
                        <span className="text-slate-300"> · {g.total_hari} hr</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700">{g.total_sesi}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{formatMenit(g.total_menit)}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {formatDate(g.jurnal_terakhir)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/institution/${institutionId}/laporan-mengajar?guru_id=${g.guru_id}&period=${filter === 'semester' ? 'all' : filter}`)}
                      >
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                loading={loading}
              />
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-slate-400">
        Skor aktivitas dihitung dari kombinasi jurnal mengajar, kehadiran, dan sesi mengajar.
        Klik &quot;Detail&quot; untuk meninjau laporan mengajar guru yang bersangkutan.
      </p>
    </div>
  )
}
