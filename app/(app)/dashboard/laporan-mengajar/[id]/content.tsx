'use client'
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, Badge, Spinner } from '@/app/components/ui'

interface JournalDetail {
  id: string
  tanggal: string
  guru_id: string
  kelas: { id: string; nama: string }
  mapel: { id: string; nama: string }
  sekolah: { id: string; nama: string }
  materi_pembelajaran: string
  tujuan_pembelajaran: string
  aktivitas_pembelajaran: string
  media_pembelajaran: string
  asesmen_pembelajaran: string
  refleksi_guru: string
  tindak_lanjut: string
  status: string
  attendance_summary: {
    hadir: number
    izin: number
    sakit: number
    alpha: number
    total: number
  } | null
  student_attendance: Array<{ student_id: string; status: string; catatan: string | null }>
  pdf_url: string | null
  docx_url: string | null
}

function SectionCard({ title, content }: { title: string; content: string | null }) {
  if (!content) return null
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">{title}</h3>
      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  )
}

export default function LaporanMengajarDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [report, setReport] = useState<JournalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/laporan-mengajar/${id}`)
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
    if (id) fetchDetail()
  }, [id])

  const downloadPdf = () => {
    window.open(`/api/laporan-mengajar/${id}/download?format=pdf`, '_blank')
  }

  const downloadDoc = () => {
    window.open(`/api/laporan-mengajar/${id}/download?format=docx`, '_blank')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Laporan tidak ditemukan</p>
      </div>
    )
  }

  const attendance = report.attendance_summary
  const studentAttendance = report.student_attendance || []

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Detail Laporan Mengajar</h1>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(report.tanggal)} • {report.mapel.nama} • Kelas {report.kelas.nama}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/laporan-harian/${report.tanggal}`)}
          >
            Laporan Harian
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={downloadDoc}>
            Download DOCX
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Kelas</p>
            <p className="font-semibold text-slate-800">{report.kelas.nama}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Mapel</p>
            <p className="font-semibold text-slate-800">{report.mapel.nama}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Sekolah</p>
            <p className="font-semibold text-slate-800">{report.sekolah.nama}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Status</p>
            <Badge variant={report.status === 'Final' ? 'green' : 'yellow'}>{report.status}</Badge>
          </div>
        </div>
      </Card>

      {/* Kehadiran */}
      {attendance && (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Kehadiran Siswa</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">{attendance.hadir}</p>
              <p className="text-xs text-emerald-500 mt-1">Hadir</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-600">{attendance.izin}</p>
              <p className="text-xs text-amber-500 mt-1">Izin</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{attendance.sakit}</p>
              <p className="text-xs text-blue-500 mt-1">Sakit</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{attendance.alpha}</p>
              <p className="text-xs text-red-500 mt-1">Alpha</p>
            </div>
          </div>
          {studentAttendance.length > 0 && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Sembunyikan' : 'Lihat'} Detail Per Siswa ({studentAttendance.length})
              </Button>
              {expanded && (
                <div className="mt-3 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-400 sticky top-0 bg-white">
                      <tr>
                        <th className="text-left py-2 px-3">No</th>
                        <th className="text-left py-2 px-3">Status</th>
                        {studentAttendance[0]?.catatan && (
                          <th className="text-left py-2 px-3">Catatan</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {studentAttendance.map((s, i) => (
                        <tr key={s.student_id} className="border-t border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{i + 1}</td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={
                                s.status === 'Hadir' ? 'green' :
                                s.status === 'Izin' ? 'yellow' :
                                s.status === 'Sakit' ? 'blue' : 'red'
                              }
                              size="sm"
                            >
                              {s.status}
                            </Badge>
                          </td>
                          {studentAttendance[0]?.catatan && (
                            <td className="py-2 px-3 text-slate-500 text-xs">{s.catatan || '-'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Journal Content */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Isi Jurnal Mengajar</h2>
        <SectionCard title="Materi Pembelajaran" content={report.materi_pembelajaran} />
        <SectionCard title="Tujuan Pembelajaran" content={report.tujuan_pembelajaran} />
        <SectionCard title="Aktivitas Pembelajaran" content={report.aktivitas_pembelajaran} />
        <SectionCard title="Media Pembelajaran" content={report.media_pembelajaran} />
        <SectionCard title="Asesmen Pembelajaran" content={report.asesmen_pembelajaran} />
        <SectionCard title="Refleksi Guru" content={report.refleksi_guru} />
        <SectionCard title="Tindak Lanjut" content={report.tindak_lanjut} />
      </Card>
    </div>
  )
}
