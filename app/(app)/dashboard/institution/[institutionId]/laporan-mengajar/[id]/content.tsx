'use client'
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useDashboardParams } from "../../../../_shared/params-context"
import { Button, Card, Badge, Spinner } from "@/app/components/ui"

interface JournalDetail {
  id: string
  tanggal: string
  guru_id: string
  guru_nama: string
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
    hadir: number; izin: number; sakit: number; alpha: number; total: number
  } | null
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

export default function InstitutionLaporanMengajarDetailPage() {
  const params = useDashboardParams()
  const routeParams = useParams()
  const institutionId = params.institutionId as string
  const id = routeParams.id as string
  const [report, setReport] = useState<JournalDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/institution/${institutionId}/laporan-mengajar/${id}`)
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
    if (institutionId && id) fetchDetail()
  }, [institutionId, id])

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
          {report.pdf_url && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/institution/${institutionId}/laporan-mengajar/${id}/download?format=pdf`, '_blank')}>
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Guru</p>
            <p className="font-semibold text-slate-800">{report.guru_nama}</p>
          </div>
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
