'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface School {
  id: string
  nama_sekolah: string
  logo: string | null
  alamat: string | null
  npsn: string | null
  created_at: string
}

interface Kelas {
  id: string
  school_id: string
  nama_kelas: string
  wali_kelas: string | null
  wali_kelas_nip: string | null
  wali_kelas_user_id: string | null
  is_wali_kelas: boolean
}

interface Ekskul {
  id: string
  nama_ekskul: string
  kelas_id: string
  pembina_user_id: string | null
  nama_kelas: string | null
}

interface Siswa {
  id: string
  class_id: string
  nama_siswa: string
  nisn: string | null
  nomor_absen: number | null
}

interface MasterData {
  school: School | null
  classes: Kelas[]
  ekskul: Ekskul[]
}

export default function MasterDataPage() {
  const router = useRouter()
  const [data, setData] = useState<MasterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'kelas' | 'ekskul' | 'siswa'>('kelas')
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null)

  // School form
  const [showSchoolModal, setShowSchoolModal] = useState(false)
  const [schoolForm, setSchoolForm] = useState({
    nama_sekolah: '',
    alamat: '',
    npsn: '',
  })
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolError, setSchoolError] = useState('')

  // Kelas form
  const [showKelasModal, setShowKelasModal] = useState(false)
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null)
  const [kelasForm, setKelasForm] = useState({
    nama_kelas: '',
    wali_kelas: '',
    wali_kelas_nip: '',
    saya_wali_kelas: false,
  })
  const [kelasSaving, setKelasSaving] = useState(false)
  const [kelasError, setKelasError] = useState('')
  const [deleteKelasTarget, setDeleteKelasTarget] = useState<Kelas | null>(null)
  const [deleteKelasLoading, setDeleteKelasLoading] = useState(false)

  // Ekskul form
  const [showEkskulModal, setShowEkskulModal] = useState(false)
  const [editingEkskul, setEditingEkskul] = useState<Ekskul | null>(null)
  const [ekskulForm, setEkskulForm] = useState({
    nama_ekskul: '',
    kelas_id: '',
  })
  const [ekskulSaving, setEkskulSaving] = useState(false)
  const [ekskulError, setEkskulError] = useState('')
  const [deleteEkskulTarget, setDeleteEkskulTarget] = useState<Ekskul | null>(null)
  const [deleteEkskulLoading, setDeleteEkskulLoading] = useState(false)

  // Siswa state
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [siswaLoading, setSiswaLoading] = useState(false)
  const [showSiswaModal, setShowSiswaModal] = useState(false)
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null)
  const [siswaForm, setSiswaForm] = useState({
    nama_siswa: '',
    nisn: '',
    nomor_absen: '',
  })
  const [siswaSaving, setSiswaSaving] = useState(false)
  const [siswaError, setSiswaError] = useState('')
  const [deleteSiswaTarget, setDeleteSiswaTarget] = useState<Siswa | null>(null)
  const [deleteSiswaLoading, setDeleteSiswaLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/master-data')
      const json = await res.json()
      if (res.ok && json.data) {
        setData(json.data)
        if (json.data.school) {
          setActiveSchoolId(json.data.school.id)
          // Auto-select first class for siswa tab
          if (json.data.classes.length > 0 && !selectedKelasId) {
            setSelectedKelasId(json.data.classes[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedKelasId])

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [])

  // Fetch siswa when class is selected
  const fetchSiswa = useCallback(async (classId: string) => {
    if (!classId) return
    setSiswaLoading(true)
    try {
      const res = await fetch(`/api/students?class_id=${classId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setSiswaList(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch siswa:', err)
    } finally {
      setSiswaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'siswa' && selectedKelasId) {
      fetchSiswa(selectedKelasId)
    }
  }, [activeTab, selectedKelasId, fetchSiswa])

  // School handlers
  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    setSchoolSaving(true)
    setSchoolError('')
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schoolForm),
      })
      if (res.ok) {
        setShowSchoolModal(false)
        setSchoolForm({ nama_sekolah: '', alamat: '', npsn: '' })
        fetchData()
      } else {
        const json = await res.json()
        setSchoolError(json.error || 'Gagal menyimpan sekolah')
      }
    } catch {
      setSchoolError('Terjadi kesalahan koneksi')
    } finally {
      setSchoolSaving(false)
    }
  }

  // Kelas handlers
  const openAddKelas = () => {
    setEditingKelas(null)
    setKelasForm({ nama_kelas: '', wali_kelas: '', wali_kelas_nip: '', saya_wali_kelas: true })
    setKelasError('')
    setShowKelasModal(true)
  }

  const openEditKelas = (k: Kelas) => {
    setEditingKelas(k)
    setKelasForm({
      nama_kelas: k.nama_kelas,
      wali_kelas: k.wali_kelas || '',
      wali_kelas_nip: k.wali_kelas_nip || '',
      saya_wali_kelas: k.is_wali_kelas,
    })
    setKelasError('')
    setShowKelasModal(true)
  }

  const handleSaveKelas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSchoolId) return
    setKelasSaving(true)
    setKelasError('')
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertKelas',
          kelas: {
            id: editingKelas?.id || null,
            nama_kelas: kelasForm.nama_kelas,
            wali_kelas: kelasForm.wali_kelas || null,
            wali_kelas_nip: kelasForm.wali_kelas_nip || null,
            saya_wali_kelas: kelasForm.saya_wali_kelas,
          },
        }),
      })
      if (res.ok) {
        setShowKelasModal(false)
        fetchData()
      } else {
        const json = await res.json()
        setKelasError(json.error || 'Gagal menyimpan kelas')
      }
    } catch {
      setKelasError('Terjadi kesalahan koneksi')
    } finally {
      setKelasSaving(false)
    }
  }

  const handleDeleteKelas = async () => {
    if (!deleteKelasTarget) return
    setDeleteKelasLoading(true)
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteKelas', id: deleteKelasTarget.id }),
      })
      if (res.ok) {
        setDeleteKelasTarget(null)
        if (selectedKelasId === deleteKelasTarget.id) setSelectedKelasId('')
        fetchData()
      }
    } finally {
      setDeleteKelasLoading(false)
    }
  }

  // Ekskul handlers
  const openAddEkskul = () => {
    setEditingEkskul(null)
    setEkskulForm({ nama_ekskul: '', kelas_id: '' })
    setEkskulError('')
    setShowEkskulModal(true)
  }

  const openEditEkskul = (e: Ekskul) => {
    setEditingEkskul(e)
    setEkskulForm({ nama_ekskul: e.nama_ekskul, kelas_id: e.kelas_id })
    setEkskulError('')
    setShowEkskulModal(true)
  }

  const handleSaveEkskul = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ekskulForm.kelas_id) return
    setEkskulSaving(true)
    setEkskulError('')
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertEkskul',
          ekskul: {
            id: editingEkskul?.id || null,
            nama_ekskul: ekskulForm.nama_ekskul,
            kelas_id: ekskulForm.kelas_id,
          },
        }),
      })
      if (res.ok) {
        setShowEkskulModal(false)
        fetchData()
      } else {
        const json = await res.json()
        setEkskulError(json.error || 'Gagal menyimpan ekstrakurikuler')
      }
    } catch {
      setEkskulError('Terjadi kesalahan koneksi')
    } finally {
      setEkskulSaving(false)
    }
  }

  const handleDeleteEkskul = async () => {
    if (!deleteEkskulTarget) return
    setDeleteEkskulLoading(true)
    try {
      const res = await fetch('/api/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteEkskul', id: deleteEkskulTarget.id }),
      })
      if (res.ok) {
        setDeleteEkskulTarget(null)
        fetchData()
      }
    } finally {
      setDeleteEkskulLoading(false)
    }
  }

  // Siswa handlers
  const openAddSiswa = () => {
    setEditingSiswa(null)
    setSiswaForm({ nama_siswa: '', nisn: '', nomor_absen: '' })
    setSiswaError('')
    setShowSiswaModal(true)
  }

  const openEditSiswa = (s: Siswa) => {
    setEditingSiswa(s)
    setSiswaForm({
      nama_siswa: s.nama_siswa,
      nisn: s.nisn || '',
      nomor_absen: s.nomor_absen?.toString() || '',
    })
    setSiswaError('')
    setShowSiswaModal(true)
  }

  const handleSaveSiswa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKelasId) return
    setSiswaSaving(true)
    setSiswaError('')
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSiswa?.id || undefined,
          class_id: selectedKelasId,
          nama_siswa: siswaForm.nama_siswa,
          nisn: siswaForm.nisn || null,
          nomor_absen: siswaForm.nomor_absen || null,
        }),
      })
      if (res.ok) {
        setShowSiswaModal(false)
        fetchSiswa(selectedKelasId)
      } else {
        const json = await res.json()
        setSiswaError(json.error || 'Gagal menyimpan siswa')
      }
    } catch {
      setSiswaError('Terjadi kesalahan koneksi')
    } finally {
      setSiswaSaving(false)
    }
  }

  const handleDeleteSiswa = async () => {
    if (!deleteSiswaTarget) return
    setDeleteSiswaLoading(true)
    try {
      const res = await fetch(`/api/students?id=${deleteSiswaTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteSiswaTarget(null)
        if (selectedKelasId) fetchSiswa(selectedKelasId)
      }
    } finally {
      setDeleteSiswaLoading(false)
    }
  }

  // No school yet
  if (!loading && !data?.school) {
    return (
      <div className="container max-w-xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-2">Master Data</h1>
        <p className="text-muted-foreground mb-6">Kelola data sekolah, kelas, ekstrakurikuler, dan siswa Anda</p>

        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-8 text-center">
          <span className="text-5xl mb-4 block">🏫</span>
          <h2 className="text-xl font-semibold text-violet-900 mb-2">
            Selamat datang di GuruPro!
          </h2>
          <p className="text-violet-700 mb-6 text-sm">
            Untuk mulai, daftarkan sekolah Anda terlebih dahulu.
            Anda bisa mengelola kelas dan ekstrakurikuler setelah sekolah dibuat.
          </p>
          <Button
            onClick={() => setShowSchoolModal(true)}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            <span>+</span>
            <span>Daftarkan Sekolah</span>
          </Button>
        </div>

        {showSchoolModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold mb-4">Daftarkan Sekolah</h2>
              {schoolError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {schoolError}
                </div>
              )}
              <form onSubmit={handleSaveSchool} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Sekolah *</label>
                  <input
                    type="text"
                    value={schoolForm.nama_sekolah}
                    onChange={e => setSchoolForm(p => ({ ...p, nama_sekolah: e.target.value }))}
                    placeholder="SMP Negeri 1 Contoh"
                    className="w-full h-10 px-3 rounded-lg border bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Alamat</label>
                  <input
                    type="text"
                    value={schoolForm.alamat}
                    onChange={e => setSchoolForm(p => ({ ...p, alamat: e.target.value }))}
                    placeholder="Jl. Pendidikan No. 1"
                    className="w-full h-10 px-3 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">NPSN *</label>
                  <input
                    type="text"
                    value={schoolForm.npsn}
                    onChange={e => setSchoolForm(p => ({ ...p, npsn: e.target.value }))}
                    placeholder="12345678"
                    className="w-full h-10 px-3 rounded-lg border bg-background"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowSchoolModal(false)} className="flex-1">
                    Batal
                  </Button>
                  <Button type="submit" disabled={schoolSaving} className="flex-1">
                    {schoolSaving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-1">Master Data</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Kelola kelas, ekstrakurikuler, dan siswa — menu Wali Kelas & Pembina Ekskul muncul setelah toggle aktif.
      </p>

      {/* School info banner */}
      {data?.school && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6 flex items-center gap-4">
          <span className="text-3xl">🏫</span>
          <div>
            <h2 className="font-semibold text-violet-900">{data.school.nama_sekolah}</h2>
            {data.school.alamat && (
              <p className="text-xs text-violet-700">{data.school.alamat}</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['kelas', 'ekskul', 'siswa'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'kelas' ? `Kelas (${data?.classes.length ?? 0})` :
             tab === 'ekskul' ? `Ekstrakurikuler (${data?.ekskul.length ?? 0})` :
             `Siswa`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* === KELAS TAB === */}
          {activeTab === 'kelas' && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={openAddKelas} className="gap-2">
                  <span>+</span><span>Tambah Kelas</span>
                </Button>
              </div>
              {data?.classes.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-xl">
                  <span className="text-4xl mb-3 block">📚</span>
                  <p className="text-muted-foreground mb-4">Belum ada kelas</p>
                  <Button onClick={openAddKelas}>Tambah Kelas Pertama</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.classes.map(k => (
                    <div key={k.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📚</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{k.nama_kelas}</h3>
                              {k.is_wali_kelas && (
                                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">
                                  Saya Wali Kelas
                                </span>
                              )}
                            </div>
                            {k.wali_kelas && !k.is_wali_kelas && (
                              <p className="text-sm text-muted-foreground">{k.wali_kelas}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditKelas(k)}>Edit</Button>
                          <Button size="sm" variant="destructive" className="bg-red-500 hover:bg-red-600 text-white" onClick={() => setDeleteKelasTarget(k)}>Hapus</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === EKSKUL TAB === */}
          {activeTab === 'ekskul' && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={openAddEkskul} className="gap-2">
                  <span>+</span><span>Tambah Ekskul</span>
                </Button>
              </div>
              {data?.ekskul.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-xl">
                  <span className="text-4xl mb-3 block">🏅</span>
                  <p className="text-muted-foreground mb-4">Belum ada ekstrakurikuler</p>
                  <Button onClick={openAddEkskul}>Tambah Ekskul Pertama</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.ekskul.map(e => (
                    <div key={e.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏅</span>
                          <div>
                            <h3 className="font-semibold">{e.nama_ekskul}</h3>
                            {e.nama_kelas && <p className="text-sm text-muted-foreground">{e.nama_kelas}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditEkskul(e)}>Edit</Button>
                          <Button size="sm" variant="destructive" className="bg-red-500 hover:bg-red-600 text-white" onClick={() => setDeleteEkskulTarget(e)}>Hapus</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === SISWA TAB === */}
          {activeTab === 'siswa' && (
            <div>
              {/* Class selector */}
              {data?.classes.length === 0 ? (
                <div className="text-center py-12 bg-muted rounded-xl">
                  <span className="text-4xl mb-3 block">👨‍🎓</span>
                  <p className="text-muted-foreground mb-4">Buat kelas terlebih dahulu untuk menambahkan siswa.</p>
                  <Button onClick={() => { setActiveTab('kelas'); openAddKelas(); }}>
                    Tambah Kelas
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <select
                        value={selectedKelasId}
                        onChange={e => setSelectedKelasId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border bg-background"
                      >
                        <option value="">Pilih kelas...</option>
                        {data?.classes.map(k => (
                          <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={openAddSiswa} disabled={!selectedKelasId} className="gap-2">
                      <span>+</span><span>Tambah Siswa</span>
                    </Button>
                  </div>

                  {!selectedKelasId ? (
                    <div className="text-center py-8 bg-muted rounded-xl">
                      <span className="text-4xl mb-3 block">👨‍🎓</span>
                      <p className="text-muted-foreground">Pilih kelas untuk melihat dan mengelola siswa.</p>
                    </div>
                  ) : siswaLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
                    </div>
                  ) : siswaList.length === 0 ? (
                    <div className="text-center py-12 bg-muted rounded-xl">
                      <span className="text-4xl mb-3 block">👨‍🎓</span>
                      <p className="text-muted-foreground mb-4">Belum ada siswa di kelas ini.</p>
                      <Button onClick={openAddSiswa}>Tambah Siswa Pertama</Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium w-16">No.</th>
                            <th className="pb-2 pr-4 font-medium">Nama Siswa</th>
                            <th className="pb-2 pr-4 font-medium">NISN</th>
                            <th className="pb-2 font-medium w-24 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siswaList.map(s => (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-2 pr-4 text-center text-sm text-muted-foreground">
                                {s.nomor_absen ?? '-'}
                              </td>
                              <td className="py-2 pr-4 font-medium">{s.nama_siswa}</td>
                              <td className="py-2 pr-4 text-sm text-muted-foreground">{s.nisn ?? '-'}</td>
                              <td className="py-2 text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="secondary" onClick={() => openEditSiswa(s)}>Edit</Button>
                                  <Button size="sm" variant="destructive" className="bg-red-500 hover:bg-red-600 text-white" onClick={() => setDeleteSiswaTarget(s)}>Hapus</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* === KELAS MODAL === */}
      {showKelasModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">{editingKelas ? 'Edit Kelas' : 'Tambah Kelas'}</h2>
            {kelasError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{kelasError}</div>
            )}
            <form onSubmit={handleSaveKelas} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Kelas *</label>
                <input type="text" value={kelasForm.nama_kelas} onChange={e => setKelasForm(p => ({ ...p, nama_kelas: e.target.value }))} placeholder="VII-A" className="w-full h-10 px-3 rounded-lg border bg-background" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama Wali Kelas</label>
                <input type="text" value={kelasForm.wali_kelas} onChange={e => setKelasForm(p => ({ ...p, wali_kelas: e.target.value }))} placeholder="Budi Santoso, S.Pd." className="w-full h-10 px-3 rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">NIP Wali Kelas</label>
                <input type="text" value={kelasForm.wali_kelas_nip} onChange={e => setKelasForm(p => ({ ...p, wali_kelas_nip: e.target.value }))} placeholder="197501012000001001" className="w-full h-10 px-3 rounded-lg border bg-background" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="saya-wali-kelas" checked={kelasForm.saya_wali_kelas} onChange={e => setKelasForm(p => ({ ...p, saya_wali_kelas: e.target.checked }))} className="w-4 h-4 accent-violet-600" />
                <label htmlFor="saya-wali-kelas" className="text-sm">Saya adalah Wali Kelas ini</label>
              </div>
              <p className="text-xs text-muted-foreground">
                {kelasForm.saya_wali_kelas ? 'Menu Wali Kelas akan muncul di sidebar setelah menyimpan.' : 'Hapus centang jika bukan Wali Kelas.'}
              </p>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowKelasModal(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={kelasSaving} className="flex-1">{kelasSaving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === EKSKUL MODAL === */}
      {showEkskulModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">{editingEkskul ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}</h2>
            {ekskulError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{ekskulError}</div>
            )}
            <form onSubmit={handleSaveEkskul} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Ekskul *</label>
                <input type="text" value={ekskulForm.nama_ekskul} onChange={e => setEkskulForm(p => ({ ...p, nama_ekskul: e.target.value }))} placeholder="Pramuka" className="w-full h-10 px-3 rounded-lg border bg-background" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kelas *</label>
                <select value={ekskulForm.kelas_id} onChange={e => setEkskulForm(p => ({ ...p, kelas_id: e.target.value }))} className="w-full h-10 px-3 rounded-lg border bg-background" required>
                  <option value="">Pilih kelas</option>
                  {data?.classes.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Anda otomatis menjadi Pembina. Menu Pembina Ekskul akan muncul di sidebar.</p>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowEkskulModal(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={ekskulSaving} className="flex-1">{ekskulSaving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === SISWA MODAL === */}
      {showSiswaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">{editingSiswa ? 'Edit Siswa' : 'Tambah Siswa'}</h2>
            {siswaError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{siswaError}</div>
            )}
            <form onSubmit={handleSaveSiswa} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Siswa *</label>
                <input type="text" value={siswaForm.nama_siswa} onChange={e => setSiswaForm(p => ({ ...p, nama_siswa: e.target.value }))} placeholder="Ahmad Fauzi" className="w-full h-10 px-3 rounded-lg border bg-background" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">NISN</label>
                <input type="text" value={siswaForm.nisn} onChange={e => setSiswaForm(p => ({ ...p, nisn: e.target.value }))} placeholder="0012345678" className="w-full h-10 px-3 rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nomor Absen</label>
                <input type="number" value={siswaForm.nomor_absen} onChange={e => setSiswaForm(p => ({ ...p, nomor_absen: e.target.value }))} placeholder="1" min="1" className="w-full h-10 px-3 rounded-lg border bg-background" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowSiswaModal(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={siswaSaving} className="flex-1">{siswaSaving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === DELETE KELAS MODAL === */}
      {deleteKelasTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">Hapus Kelas</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Hapus kelas <strong>{deleteKelasTarget.nama_kelas}</strong>? Semua siswa di kelas ini juga ikut terhapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setDeleteKelasTarget(null)} className="flex-1">Batal</Button>
              <Button onClick={handleDeleteKelas} disabled={deleteKelasLoading} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                {deleteKelasLoading ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === DELETE EKSKUL MODAL === */}
      {deleteEkskulTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">Hapus Ekstrakurikuler</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Hapus ekstrakurikuler <strong>{deleteEkskulTarget.nama_ekskul}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setDeleteEkskulTarget(null)} className="flex-1">Batal</Button>
              <Button onClick={handleDeleteEkskul} disabled={deleteEkskulLoading} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                {deleteEkskulLoading ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === DELETE SISWA MODAL === */}
      {deleteSiswaTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-2">Hapus Siswa</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Hapus siswa <strong>{deleteSiswaTarget.nama_siswa}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setDeleteSiswaTarget(null)} className="flex-1">Batal</Button>
              <Button onClick={handleDeleteSiswa} disabled={deleteSiswaLoading} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                {deleteSiswaLoading ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
