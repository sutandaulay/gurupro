'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { Input } from '@/app/components/ui/form'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

const KATEGORI_OPTIONS = [
  { value: 'sertifikat_pelatihan', label: 'Sertifikat Pelatihan' },
  { value: 'piagam_penghargaan', label: 'Piagam Penghargaan' },
  { value: 'sk_mengajar', label: 'SK Mengajar' },
  { value: 'surat_tugas', label: 'Surat Tugas' },
  { value: 'dokumentasi_kegiatan', label: 'Dokumentasi Kegiatan' },
  { value: 'karya_inovasi', label: 'Karya Inovasi' },
  { value: 'publikasi', label: 'Publikasi' },
  { value: 'lainnya', label: 'Lainnya' },
]

const INDIKATOR_OPTIONS = [
  { value: 'IK-01', label: 'IK-01 Perencanaan Pembelajaran' },
  { value: 'IK-02', label: 'IK-02 Pengembangan Perangkat Ajar' },
  { value: 'IK-03', label: 'IK-03 Pelaksanaan Pembelajaran' },
  { value: 'IK-04', label: 'IK-04 Dokumentasi Pembelajaran' },
  { value: 'IK-05', label: 'IK-05 Asesmen Pembelajaran' },
  { value: 'IK-06', label: 'IK-06 Evaluasi Hasil Belajar' },
  { value: 'IK-07', label: 'IK-07 Tindak Lanjut Pembelajaran' },
  { value: 'IK-08', label: 'IK-08 Refleksi Praktik Mengajar' },
  { value: 'IK-09', label: 'IK-09 Kolaborasi dengan Orang Tua' },
  { value: 'IK-10', label: 'IK-10 Pengembangan Kompetensi Profesional' },
  { value: 'IK-11', label: 'IK-11 Kontribusi pada Komunitas Belajar' },
  { value: 'IK-12', label: 'IK-12 Inovasi Pembelajaran' },
]

export default function TambahDokumenPage() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const [formData, setFormData] = useState({
    kategori: '',
    judul: '',
    deskripsi: '',
    tanggalDokumen: '',
    penerbit: '',
    indikatorKinerja: [] as string[],
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (file: File | null) => {
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setError('Format file tidak didukung. Gunakan PDF, JPG, atau PNG.')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Ukuran file maksimal 5MB.')
        return
      }
      setSelectedFile(file)
      setError('')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    handleFileChange(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('File wajib diupload')
      return
    }

    setLoading(true)
    setError('')

    try {
      const semester = typeof window !== 'undefined' ? (localStorage.getItem('semester') || '') : ''
      const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : ''

      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('kategori', formData.kategori)
      fd.append('judul', formData.judul)
      fd.append('deskripsi', formData.deskripsi)
      fd.append('tanggal_dokumen', formData.tanggalDokumen)
      fd.append('penerbit', formData.penerbit)
      fd.append('indikator_kinerja', JSON.stringify(formData.indikatorKinerja))
      fd.append('semester', semester)
      fd.append('tahun_ajaran_id', tahunAjaranId)
      fd.append('sekolah_id', activeSchoolId)

      const res = await fetch('/api/dokumen-bukti', {
        method: 'POST',
        body: fd,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal upload dokumen')
      }

      router.push('/dashboard/pengembangan-diri')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleIndikator = (value: string) => {
    setFormData(prev => ({
      ...prev,
      indikatorKinerja: prev.indikatorKinerja.includes(value)
        ? prev.indikatorKinerja.filter(i => i !== value)
        : [...prev.indikatorKinerja, value],
    }))
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">📎 Upload Dokumen Bukti</h1>
      <p className="text-muted-foreground mb-6">
        Upload dokumen pendukung seperti piagam, SK, atau surat tugas
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Kategori Dokumen *</label>
          <select
            value={formData.kategori}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, kategori: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border bg-background"
            required
          >
            <option value="">Pilih kategori...</option>
            {KATEGORI_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <Input
          label="Judul Dokumen *"
          value={formData.judul}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
          placeholder="Contoh: Piagam Penghargaan Lomba MGMP 2024"
          required
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">Deskripsi</label>
          <textarea
            value={formData.deskripsi}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
            placeholder="Konteks dokumen ini, relevansinya ke kinerja..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Tanggal Dokumen"
            value={formData.tanggalDokumen}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, tanggalDokumen: e.target.value }))}
          />
          <Input
            label="Diterbitkan oleh"
            value={formData.penerbit}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, penerbit: e.target.value }))}
            placeholder="Contoh: Kemendikbudristek"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Indikator Kinerja yang Dipenuhi</label>
          <div className="grid grid-cols-2 gap-2">
            {INDIKATOR_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm',
                  formData.indikatorKinerja.includes(opt.value)
                    ? 'border-violet-500 bg-violet-50'
                    : 'hover:bg-muted/50'
                )}
              >
                <input
                  type="checkbox"
                  checked={formData.indikatorKinerja.includes(opt.value)}
                  onChange={() => toggleIndikator(opt.value)}
                  className="accent-violet-600"
                />
                <span className="truncate">{opt.value}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Upload File *</label>
          <div
            onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              dragActive
                ? 'border-violet-500 bg-violet-50'
                : 'border-gray-300 hover:border-violet-400 hover:bg-muted/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />

            {selectedFile ? (
              <div>
                <span className="text-3xl mb-2 block">📄</span>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <span className="text-3xl mb-2 block">📤</span>
                <p className="font-medium">Drop file di sini atau klik untuk pilih</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG, WebP — maksimal 5MB
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedFile || !formData.kategori || !formData.judul}
            className="flex-1"
          >
            {loading ? 'Mengupload...' : 'Simpan Dokumen'}
          </Button>
        </div>
      </form>
    </div>
  )
}
