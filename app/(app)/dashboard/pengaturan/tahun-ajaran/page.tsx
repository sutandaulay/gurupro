'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'
import { useActiveSchool } from '@/lib/stores'

interface TahunAjaran {
  id: string
  nama: string
  tanggal_mulai: string
  tanggal_selesai: string
  is_active: boolean
  created_at: string
}

export default function TahunAjaranPage() {
  const router = useRouter()
  const { activeSchoolId } = useActiveSchool()
  const [tahunAjaran, setTahunAjaran] = useState<TahunAjaran[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedTa, setSelectedTa] = useState<string>('')
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    nama: '',
    tanggalMulai: '',
    tanggalSelesai: '',
  })
  const [saving, setSaving] = useState(false)

  // Delete modal state
  const [deleteModalTa, setDeleteModalTa] = useState<TahunAjaran | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingTa, setDeletingTa] = useState(false)
  const [deleteTaError, setDeleteTaError] = useState('')

  const [tahunAjaranNama, setTahunAjaranNama] = useState('Belum dipilih')

  useEffect(() => {
    setTahunAjaranNama(localStorage.getItem('tahunAjaranNama') || 'Belum dipilih')
  }, [])

  // Activate loading
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const fetchTahunAjaran = async () => {
    setLoading(true)
    try {
      const params = activeSchoolId ? `?sekolah_id=${activeSchoolId}` : ''
      const res = await apiFetch(`/api/tahun-ajaran${params}`)
      const data = await res.json()

      if (res.ok) {
        setTahunAjaran(data)
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTahunAjaran()
  }, [])

  const handleActivate = async (id: string) => {
    setActivatingId(id)
    try {
      const res = await apiFetch(`/api/tahun-ajaran/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })

      if (res.ok) {
        setTahunAjaran(prev =>
          prev.map(ta => ({
            ...ta,
            is_active: ta.id === id,
          }))
        )
        localStorage.setItem('tahunAjaranId', id)
        const selected = tahunAjaran.find(ta => ta.id === id)
        if (selected) {
          localStorage.setItem('tahunAjaranNama', selected.nama)
        }
      } else {
        const data = await res.json()
        console.error('Failed to activate:', data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Failed to activate:', err)
    } finally {
      setActivatingId(null)
    }
  }

  const handleSelect = (ta: TahunAjaran) => {
    localStorage.setItem('tahunAjaranId', ta.id)
    localStorage.setItem('tahunAjaranNama', ta.nama)
    localStorage.setItem('semester', getSemesterFromDate(new Date(ta.tanggal_mulai)))
    setSelectedTa(ta.id)
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await apiFetch('/api/tahun-ajaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, sekolahId: activeSchoolId || null }),
      })

      if (res.ok) {
        setShowModal(false)
        setFormData({ nama: '', tanggalMulai: '', tanggalSelesai: '' })
        fetchTahunAjaran()
      } else {
        const data = await res.json()
        setError(data.error || 'Gagal membuat tahun ajaran')
      }
    } catch (err) {
      setError('Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTahunAjaran = async () => {
    if (!deleteModalTa || !deletePassword) return
    setDeletingTa(true)
    setDeleteTaError('')
    try {
      const res = await apiFetch('/api/tahun-ajaran/' + deleteModalTa.id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setDeleteModalTa(null)
        setDeletePassword('')
        fetchTahunAjaran()
      } else {
        setDeleteTaError(data.error || 'Gagal menghapus')
      }
    } catch {
      setDeleteTaError('Terjadi kesalahan koneksi')
    } finally {
      setDeletingTa(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const generateTahunAjaran = () => {
    const year = new Date().getFullYear()
    setFormData({
      nama: `${year}/${year + 1}`,
      tanggalMulai: `${year}-07-15`,
      tanggalSelesai: `${year + 1}-06-30`,
    })
    setShowModal(true)
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📅 Tahun Ajaran</h1>
          <p className="text-muted-foreground mt-1">
            Kelola tahun ajaran untuk mengatur periode data Anda
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <span>+</span>
          <span>Tambah</span>
        </Button>
      </div>

      {/* Quick Generate */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-violet-800 mb-3">
          💡 Buat tahun ajaran baru dengan cepat:
        </p>
        <div className="flex gap-3">
          <Button onClick={generateTahunAjaran} size="sm" variant="secondary">
            {new Date().getFullYear()}/{new Date().getFullYear() + 1}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const year = new Date().getFullYear() - 1
              setFormData({
                nama: `${year - 1}/${year}`,
                tanggalMulai: `${year - 1}-07-15`,
                tanggalSelesai: `${year}-06-30`,
              })
              setShowModal(true)
            }}
          >
            {new Date().getFullYear() - 1}/{new Date().getFullYear()}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tahunAjaran.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-xl">
          <span className="text-5xl mb-4 block">📅</span>
          <p className="text-muted-foreground">Belum ada tahun ajaran</p>
          <Button onClick={() => setShowModal(true)} className="mt-4">
            Buat Tahun Ajaran Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tahunAjaran.map(ta => (
            <div
              key={ta.id}
              className={cn(
                'border rounded-xl p-4 transition-all cursor-pointer',
                ta.is_active
                  ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200'
                  : 'hover:bg-muted/50'
              )}
              onClick={() => handleSelect(ta)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{ta.nama}</h3>
                    {ta.is_active && (
                      <span className="px-2 py-0.5 bg-violet-600 text-white text-xs rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(ta.tanggal_mulai)} — {formatDate(ta.tanggal_selesai)}
                  </p>
                </div>

                {!ta.is_active && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={activatingId === ta.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleActivate(ta.id)
                      }}
                    >
                      Aktifkan
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="bg-red-500 hover:bg-red-600 text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteModalTa(ta)
                        setDeletePassword('')
                        setDeleteTaError('')
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Selection */}
      <div className="mt-6 p-4 bg-muted rounded-xl">
        <p className="text-sm text-muted-foreground">
          Tahun ajaran yang sedang aktif:
        </p>
        <p className="font-semibold">
          {tahunAjaranNama}
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">📅 Tambah Tahun Ajaran</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Tahun Ajaran *</label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={e => setFormData(prev => ({ ...prev, nama: e.target.value }))}
                  placeholder="2024/2025"
                  className="w-full h-10 px-3 rounded-lg border bg-background"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Mulai *</label>
                <input
                  type="date"
                  value={formData.tanggalMulai}
                  onChange={e => setFormData(prev => ({ ...prev, tanggalMulai: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border bg-background"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tanggal mulai tahun ajaran baru (biasanya 15 Juli)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Selesai *</label>
                <input
                  type="date"
                  value={formData.tanggalSelesai}
                  onChange={e => setFormData(prev => ({ ...prev, tanggalSelesai: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border bg-background"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tanggal selesai tahun ajaran (biasanya 30 Juni)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalTa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">🗑️ Hapus Tahun Ajaran</h2>
            <p className="text-muted-foreground text-sm mb-1">
              Apakah Anda yakin ingin menghapus tahun ajaran <strong>{deleteModalTa.nama}</strong>?
            </p>
            <p className="text-red-600 text-sm font-medium mb-4">
              Tindakan ini tidak dapat dibatalkan.
            </p>

            {deleteTaError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                {deleteTaError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Masukkan password Anda untuk konfirmasi</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Password Anda"
                  className="w-full h-10 px-3 rounded-lg border bg-background"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDeleteModalTa(null)
                    setDeletePassword('')
                    setDeleteTaError('')
                  }}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={deletingTa || !deletePassword}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleDeleteTahunAjaran}
                >
                  {deletingTa ? 'Menghapus...' : 'Hapus'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function
function getSemesterFromDate(date: Date): 'ganjil' | 'genap' {
  const month = date.getMonth() + 1
  return month >= 7 ? 'ganjil' : 'genap'
}
