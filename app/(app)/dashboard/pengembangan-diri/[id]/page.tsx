'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { Input } from '@/app/components/ui/form'
import { cn } from '@/lib/utils'

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

function EditPelatihanContent() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const searchParams = useSearchParams()
  const action = searchParams.get('action')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

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

  const fetchPelatihan = async () => {
    try {
      const res = await apiFetch(`/api/pelatihan/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil data')
      }

      setFormData({
        namaPelatihan: data.nama_pelatihan || '',
        penyelenggara: data.penyelenggara || '',
        jenis: data.jenis || 'workshop',
        lingkup: data.lingkup || 'nasional',
        tanggalMulai: data.tanggal_mulai?.split('T')[0] || '',
        tanggalSelesai: data.tanggal_selesai?.split('T')[0] || '',
        durasiJam: String(data.durasi_jam || ''),
        nomorSertifikat: data.nomor_sertifikat || '',
        deskripsi: data.deskripsi || '',
        relevansiMapel: data.relevansi_mapel ?? true,
        kompetensiDikembangkan: data.kompetensi_dikembangkan || [],
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPelatihan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await apiFetch(`/api/pelatihan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          durasiJam: parseInt(formData.durasiJam),
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
      setSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Format file tidak didukung. Gunakan PDF, JPG, atau PNG.')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Ukuran file maksimal 5MB.')
        return
      }
      setSelectedFile(file)
      setUploadError('')
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setUploadError('Pilih file terlebih dahulu')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const fd = new FormData()
      fd.append('file', selectedFile)

      const res = await apiFetch(`/api/pelatihan/${id}/upload-sertifikat`, {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah sertifikat')
      }

      router.push('/dashboard/pengembangan-diri')
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
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

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (action === 'upload') {
    return (
      <div className="container max-w-md mx-auto py-6 px-4">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
          <span>←</span>
          <span>Kembali</span>
        </Button>

        <h1 className="text-2xl font-bold mb-1">📜 Upload Sertifikat</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Unggah berkas sertifikat untuk pelatihan: <strong className="text-slate-800">{formData.namaPelatihan}</strong>
        </p>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {uploadError}
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-xl p-6 text-center cursor-pointer transition-colors relative bg-white">
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              required
            />
            <div className="text-4xl mb-2">📄</div>
            {selectedFile ? (
              <div>
                <p className="font-medium text-sm text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-sm text-slate-700">Pilih berkas sertifikat Anda</p>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung PDF, JPG, PNG, atau WEBP (Maks 5MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={uploading || !selectedFile} className="w-full">
              {uploading ? 'Mengunggah...' : 'Upload Sertifikat'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/dashboard/pengembangan-diri/${id}`)}
              className="w-full"
            >
              Batal
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">✏️ Edit Pelatihan</h1>
      <p className="text-muted-foreground mb-6">Perbarui informasi pelatihan Anda</p>

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
            required
          />

          <Input
            label="Penyelenggara *"
            value={formData.penyelenggara}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, penyelenggara: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Jenis *</label>
              <select
                value={formData.jenis}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, jenis: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border bg-background"
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
                className="w-full h-10 px-3 rounded-md border bg-background"
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
              required
            />

            <Input
              label="No. Sertifikat"
              value={formData.nomorSertifikat}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, nomorSertifikat: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Kompetensi yang Dikembangkan
          </h2>

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

        <div>
          <label className="block text-sm font-medium mb-1.5">Ceritakan Dampak Pelatihan</label>
          <textarea
            value={formData.deskripsi}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
            rows={4}
            className="w-full mt-1 px-3 py-2 rounded-md border bg-background resize-none"
          />
        </div>

        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/dashboard/pengembangan-diri/${id}?action=upload`)}
            className="w-full gap-2"
          >
            <span>📎</span>
            <span>Upload Sertifikat</span>
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function EditPelatihanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Memuat halaman edit...</p>
        </div>
      </div>
    }>
      <EditPelatihanContent />
    </Suspense>
  )
}
