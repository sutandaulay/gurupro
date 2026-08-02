'use client'
import { apiFetch } from "@/lib/api-client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { Input } from '@/app/components/ui/form'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

const JENIS_OPTIONS = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'diklat', label: 'Diklat' },
  { value: 'bimtek', label: 'Bimtek' },
  { value: 'pelatihan_mandiri', label: 'Pelatihan Mandiri' },
  { value: 'komunitas_belajar', label: 'Komunitas Belajar' },
  { value: 'studi_banding', label: 'Studi Banding' },
  { value: 'lainnya', label: 'Lainnya' },
]

const LINGKUP_OPTIONS = [
  { value: 'internasional', label: '🌍 Internasional' },
  { value: 'nasional', label: '🇮🇩 Nasional' },
  { value: 'provinsi', label: '📍 Provinsi' },
  { value: 'kabupaten', label: '📍 Kabupaten/Kota' },
  { value: 'sekolah', label: '🏫 Tingkat Sekolah' },
  { value: 'mandiri', label: '📱 Mandiri' },
]

const KOMPETENSI_OPTIONS = [
  { value: 'pedagogik', label: 'Pedagogik', desc: 'Cara mengajar, strategi pembelajaran' },
  { value: 'profesional', label: 'Profesional', desc: 'Penguasaan materi bidang studi' },
  { value: 'sosial', label: 'Sosial', desc: 'Hubungan dengan siswa, rekan, orang tua' },
  { value: 'kepribadian', label: 'Kepribadian', desc: 'Pengembangan karakter dan etos kerja' },
]

export default function TambahPelatihanPage() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    namaPelatihan: '',
    penyelenggara: '',
    jenis: 'workshop',
    lingkup: 'nasional',
    tanggalMulai: '',
    tanggalSelesai: '',
    durasiJam: '',
    nomorSertifikat: '',
    deskripsi: '',
    relevansiMapel: true,
    kompetensiDikembangkan: [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const semester = typeof window !== 'undefined' ? (localStorage.getItem('semester') || '') : ''
      const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : ''

      const res = await apiFetch('/api/pelatihan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          durasiJam: parseInt(formData.durasiJam),
          semester,
          tahunAjaranId,
          sekolahId: activeSchoolId
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pelatihan')
      }

      router.push('/dashboard/pengembangan-diri')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleKompetensi = (value: string) => {
    setFormData(prev => ({
      ...prev,
      kompetensiDikembangkan: prev.kompetensiDikembangkan.includes(value)
        ? prev.kompetensiDikembangkan.filter(k => k !== value)
        : [...prev.kompetensiDikembangkan, value],
    }))
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">🎓 Tambah Pelatihan</h1>
      <p className="text-muted-foreground mb-6">
        Catat pelatihan atau pengembangan diri yang pernah Anda ikuti
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Informasi Pelatihan
          </h2>

          <Input
            label="Nama Pelatihan *"
            value={formData.namaPelatihan}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, namaPelatihan: e.target.value }))}
            placeholder="Contoh: Bimtek Kurikulum Merdeka 2024"
            required
          />

          <Input
            label="Penyelenggara *"
            value={formData.penyelenggara}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, penyelenggara: e.target.value }))}
            placeholder="Contoh: Kemendikbudristek / MGMP / PGRI"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Jenis Pelatihan *</label>
              <select
                value={formData.jenis}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, jenis: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border bg-background"
                required
              >
                {JENIS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Lingkup *</label>
              <select
                value={formData.lingkup}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, lingkup: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border bg-background"
                required
              >
                {LINGKUP_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Tanggal Mulai *"
              value={formData.tanggalMulai}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, tanggalMulai: e.target.value }))}
              required
            />

            <Input
              type="date"
              label="Tanggal Selesai *"
              value={formData.tanggalSelesai}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, tanggalSelesai: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Durasi (jam) *"
              value={formData.durasiJam}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, durasiJam: e.target.value }))}
              placeholder="24"
              required
            />

            <Input
              label="No. Sertifikat"
              value={formData.nomorSertifikat}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, nomorSertifikat: e.target.value }))}
              placeholder="Opsional"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Relevansi & Kompetensi
          </h2>

          <div>
            <label className="block mb-2">Relevan dengan mata pelajaran yang Anda ajar?</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.relevansiMapel === true}
                  onChange={() => setFormData(prev => ({ ...prev, relevansiMapel: true }))}
                  className="accent-violet-600"
                />
                <span>Ya</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.relevansiMapel === false}
                  onChange={() => setFormData(prev => ({ ...prev, relevansiMapel: false }))}
                  className="accent-violet-600"
                />
                <span>Tidak</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block mb-2">Kompetensi yang dikembangkan *</label>
            <p className="text-xs text-muted-foreground mb-2">Pilih minimal 1 kompetensi</p>
            <div className="grid grid-cols-2 gap-3">
              {KOMPETENSI_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    formData.kompetensiDikembangkan.includes(opt.value)
                      ? 'border-violet-500 bg-violet-50'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.kompetensiDikembangkan.includes(opt.value)}
                    onChange={() => toggleKompetensi(opt.value)}
                    className="mt-1 accent-violet-600"
                  />
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Ceritakan Dampak Pelatihan
          </h2>

          <div>
            <textarea
              value={formData.deskripsi}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
              placeholder="Misalnya: Mempelajari teknik asesmen formatif tanpa angka. Langsung saya terapkan di kelas VII A dengan metode observasi dan portofolio berbasis projek."
              rows={4}
              className="w-full px-3 py-2 rounded-md border bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Opsional - membantu memperkuat evidence di laporan kinerja
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading || formData.kompetensiDikembangkan.length === 0}
            className="flex-1"
          >
            {loading ? 'Menyimpan...' : 'Simpan Pelatihan'}
          </Button>
        </div>
      </form>
    </div>
  )
}
