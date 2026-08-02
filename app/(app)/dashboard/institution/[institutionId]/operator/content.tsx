"use client"
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDashboardParams } from "../../../_shared/params-context"
import { Button, Card, Badge, Spinner } from "@/app/components/ui"
import { Input, Select, Label } from "@/app/components/ui/form"
import { useToast } from "@/app/components/ui/toast"

interface Institution {
  id: number
  name: string
  npsn: string | null
  jenjang: string
  naungan: string
  subscription_tier: string | null
  academic_year_active: string | null
  status: string | null
}

interface Member {
  id: number
  user_id: number
  app_user_id: string | null
  institution_id: number
  status: string
  joined_at: string | null
  created_at: string
  cms_user_name: string
  cms_user_email: string
  app_user_email: string | null
  nama_lengkap: string | null
  whatsapp: string | null
  roles: { role: string }[]
  assigned_mapel: { mapel: string }[]
  assigned_kelas: { kelas: string }[]
}

const statusVariant: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  active: "success",
  invited: "warning",
  left: "error",
  rejected: "error",
}

const roleLabel: Record<string, string> = {
  kepala_sekolah: "Kepala Sekolah",
  wakasek: "Wakasek",
  operator: "Operator",
  admin_sekolah: "Admin Sekolah",
  bendahara: "Bendahara",
  guru: "Guru",
}

export default function OperatorDashboardPage() {
  const params = useDashboardParams()
  const router = useRouter()
  const toast = useToast()
  const institutionId = params.institutionId as string
  const instId = parseInt(institutionId, 10)

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Member | null>(null)
  const [showResetPwModal, setShowResetPwModal] = useState<Member | null>(null)
  const [showAcademicModal, setShowAcademicModal] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [instRes, membersRes] = await Promise.all([
        apiFetch(`/api/institution/${institutionId}`),
        apiFetch(`/api/institution/${institutionId}/members`),
      ])
      if (instRes.status === 403 || membersRes.status === 403) {
        router.push("/dashboard")
        return
      }
      if (!instRes.ok || !membersRes.ok) {
        setError("Gagal memuat data")
        return
      }
      const instData = await instRes.json()
      const membersData = await membersRes.json()
      setInstitution(instData)
      setMembers(Array.isArray(membersData) ? membersData : [])
    } catch {
      setError("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [institutionId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const activeMembers = members.filter((m) => m.status === "active")
  const invitedMembers = members.filter((m) => m.status === "invited")

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <HeaderSection
        institution={institution}
        onEditAcademic={() => setShowAcademicModal(true)}
      />

      <StatsCards
        total={members.length}
        active={activeMembers.length}
        invited={invitedMembers.length}
      />

      <ActionBar
        onAddTeacher={() => setShowAddModal(true)}
        onImportExcel={() => setShowImportModal(true)}
      />

      {/* Sprint 4.1 — Ekspor ke Dapodik */}
      <DapodikExportCard institutionId={instId} academicYear={institution?.academic_year_active || "2025/2026"} />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-600">{error}</div>
      ) : (
        <MembersTable
          members={members}
          onEdit={(m) => setShowEditModal(m)}
          onResetPassword={(m) => setShowResetPwModal(m)}
          onRefresh={fetchData}
        />
      )}

      {showAddModal && (
        <AddTeacherModal
          institutionId={instId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchData() }}
        />
      )}

      {showImportModal && (
        <ImportExcelModal
          institutionId={instId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchData() }}
        />
      )}

      {showEditModal && (
        <EditAssignmentModal
          member={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSuccess={() => { setShowEditModal(null); fetchData() }}
        />
      )}

      {showResetPwModal && (
        <ResetPasswordModal
          member={showResetPwModal}
          institutionId={instId}
          onClose={() => setShowResetPwModal(null)}
        />
      )}

      {showAcademicModal && institution && (
        <AcademicYearModal
          institution={institution}
          onClose={() => setShowAcademicModal(false)}
          onSuccess={() => { setShowAcademicModal(false); fetchData() }}
        />
      )}
    </div>
  )
}

function HeaderSection({
  institution,
  onEditAcademic,
}: {
  institution: Institution | null
  onEditAcademic: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {institution?.name || "Dashboard Operator"}
        </h1>
        {institution && (
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>Jenjang: {institution.jenjang}</span>
            <span>•</span>
            <span>Naungan: {institution.naungan}</span>
            {institution.npsn && (
              <>
                <span>•</span>
                <span>NPSN: {institution.npsn}</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {institution && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Tahun Ajaran Aktif</p>
            <p className="text-sm font-semibold text-gray-900">
              {institution.academic_year_active || "Belum diatur"}
            </p>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onEditAcademic}>
          Kelola
        </Button>
      </div>
    </div>
  )
}

function StatsCards({
  total,
  active,
  invited,
}: {
  total: number
  active: number
  invited: number
}) {
  const stats = [
    { label: "Total Anggota", value: total, color: "text-gray-900" },
    { label: "Aktif", value: active, color: "text-green-600" },
    { label: "Menunggu Konfirmasi", value: invited, color: "text-amber-600" },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 sm:p-5">
          <p className="text-sm text-gray-500">{s.label}</p>
          <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
        </Card>
      ))}
    </div>
  )
}

function ActionBar({
  onAddTeacher,
  onImportExcel,
}: {
  onAddTeacher: () => void
  onImportExcel: () => void
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Button variant="primary" size="md" onClick={onAddTeacher}>
        + Tambah Guru
      </Button>
      <Button variant="secondary" size="md" onClick={onImportExcel}>
        Import Excel
      </Button>
    </div>
  )
}

function MembersTable({
  members,
  onEdit,
  onResetPassword,
  onRefresh,
}: {
  members: Member[]
  onEdit: (m: Member) => void
  onResetPassword: (m: Member) => void
  onRefresh: () => void
}) {
  const toast = useToast()

  const handleToggleStatus = async (member: Member) => {
    const newStatus = member.status === "active" ? "left" : "active"
    if (!confirm(`${newStatus === "left" ? "Nonaktifkan" : "Aktifkan"} anggota ${member.nama_lengkap || member.cms_user_name}?`)) return

    try {
      const res = await apiFetch(`/api/institution/${member.institution_id}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success("Status berhasil diperbarui")
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal memperbarui status")
      }
    } catch {
      toast.error("Gagal memperbarui status")
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Mapel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Kelas</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  Belum ada anggota. Tambahkan guru untuk memulai.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{m.nama_lengkap || m.cms_user_name}</p>
                    {m.whatsapp && <p className="text-xs text-gray-400">{m.whatsapp}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.app_user_email || m.cms_user_email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.roles.length > 0 ? (
                        m.roles.map((r, i) => (
                          <Badge key={i} variant="default">{roleLabel[r.role] || r.role}</Badge>
                        ))
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[m.status] || "default"}>
                      {m.status === "active" ? "Aktif" : m.status === "invited" ? "Diundang" : m.status === "left" ? "Nonaktif" : "Ditolak"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.assigned_mapel.length > 0
                      ? m.assigned_mapel.map((a) => a.mapel).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.assigned_kelas.length > 0
                      ? m.assigned_kelas.map((a) => a.kelas).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {m.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onResetPassword(m)}
                        >
                          Reset PW
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onEdit(m)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(m)}
                      >
                        {m.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AddTeacherModal({
  institutionId,
  onClose,
  onSuccess,
}: {
  institutionId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({ nama: "", email: "", nik: "", mapel: "", kelas: "" })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.nama.trim()) errs.nama = "Nama wajib diisi"
    if (!form.email.trim()) errs.email = "Email wajib diisi"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Format email tidak valid"
    if (form.nik && !/^\d+$/.test(form.nik)) errs.nik = "NIK harus berupa angka"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/institution/${institutionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Undangan berhasil dikirim", `Email telah dikirim ke ${form.email}`)
        onSuccess()
      } else {
        toast.error(data.error || "Gagal mengundang guru")
      }
    } catch {
      toast.error("Gagal mengundang guru")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Tambah Guru (Manual)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nama Lengkap"
          required
          placeholder="Masukkan nama guru"
          value={form.nama}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          error={errors.nama || null}
        />
        <Input
          label="Email"
          required
          type="email"
          placeholder="guru@sekolah.sch.id"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email || null}
        />
        <Input
          label="NIK (opsional)"
          placeholder="Masukkan NIK"
          value={form.nik}
          onChange={(e) => setForm({ ...form, nik: e.target.value })}
          error={errors.nik || null}
        />
        <Input
          label="Mata Pelajaran (opsional)"
          placeholder="Pisahkan dengan koma, misal: Matematika, IPA"
          value={form.mapel}
          onChange={(e) => setForm({ ...form, mapel: e.target.value })}
        />
        <Input
          label="Kelas (opsional)"
          placeholder="Pisahkan dengan koma, misal: 7A, 7B"
          value={form.kelas}
          onChange={(e) => setForm({ ...form, kelas: e.target.value })}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button variant="primary" type="submit" loading={saving}>Kirim Undangan</Button>
        </div>
      </form>
    </Modal>
  )
}

function ImportExcelModal({
  institutionId,
  onClose,
  onSuccess,
}: {
  institutionId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    total: number
    berhasil: number
    gagal: number
    sudah_punya_akun_individual: number
    details: { baris: number; email: string; status: string; keterangan: string }[]
  } | null>(null)

  const handleImport = async () => {
    if (!file) {
      toast.error("Pilih file Excel terlebih dahulu")
      return
    }
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch(`/api/institution/${institutionId}/members/import`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        toast.success("Proses impor selesai")
      } else {
        toast.error(data.error || "Gagal mengimpor data")
      }
    } catch {
      toast.error("Gagal mengimpor data")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Import Guru dari Excel">
      {!result ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">Format file .xlsx:</p>
            <p>Kolom: <strong>nama</strong>, <strong>email</strong>, <strong>nik</strong>, <strong>mapel</strong>, <strong>kelas</strong></p>
            <p className="mt-1 text-xs">Baris pertama akan dibaca sebagai header.</p>
          </div>
          <div>
            <Label>Pilih File Excel</Label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={handleImport} loading={importing} disabled={!file}>
              Import
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{result.berhasil}</p>
              <p className="text-xs text-green-700">Berhasil</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{result.gagal}</p>
              <p className="text-xs text-red-700">Gagal</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.sudah_punya_akun_individual}</p>
              <p className="text-xs text-amber-700">Punya Akun Individual</p>
            </div>
          </div>

          {result.details.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-2 py-1.5">Baris</th>
                    <th className="text-left px-2 py-1.5">Email</th>
                    <th className="text-left px-2 py-1.5">Status</th>
                    <th className="text-left px-2 py-1.5">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.details.map((d, i) => (
                    <tr key={i} className={d.status === "gagal" ? "bg-red-50" : "bg-green-50"}>
                      <td className="px-2 py-1.5">{d.baris}</td>
                      <td className="px-2 py-1.5">{d.email}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant={d.status === "gagal" ? "error" : d.status === "sudah_aktif" ? "success" : "info"}>
                          {d.status === "gagal" ? "Gagal" : d.status === "sudah_aktif" ? "Sudah Aktif" : "Diundang"}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">{d.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
            <Button variant="primary" onClick={() => { setResult(null); setFile(null); onSuccess() }}>
              Selesai
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ResetPasswordModal({
  member,
  institutionId,
  onClose,
}: {
  member: Member
  institutionId: number
  onClose: () => void
}) {
  const toast = useToast()
  const [sending, setSending] = useState(false)

  const handleReset = async () => {
    setSending(true)
    try {
      const res = await apiFetch(`/api/institution/${institutionId}/members/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("OTP reset password dikirim", data.message)
        onClose()
      } else {
        toast.error(data.error || "Gagal mengirim OTP")
      }
    } catch {
      toast.error("Gagal mengirim OTP")
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Reset Password Guru">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Anda akan mengirim OTP reset password ke <strong>{member.nama_lengkap || member.cms_user_name}</strong>.
          Guru tersebut akan menerima kode OTP melalui email/WhatsApp terdaftar untuk mengatur ulang password.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          OTP berlaku selama 10 menit. Pastikan guru tersebut dapat mengakses email/WhatsAppnya.
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleReset} loading={sending}>
            Kirim OTP Reset
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function EditAssignmentModal({
  member,
  onClose,
  onSuccess,
}: {
  member: Member
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [mapel, setMapel] = useState(member.assigned_mapel.map((a) => a.mapel).join(", "))
  const [kelas, setKelas] = useState(member.assigned_kelas.map((a) => a.kelas).join(", "))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/api/institution/${member.institution_id}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapel, kelas }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Assignment berhasil diperbarui")
        onSuccess()
      } else {
        toast.error(data.error || "Gagal memperbarui assignment")
      }
    } catch {
      toast.error("Gagal memperbarui assignment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit Assignment: ${member.nama_lengkap || member.cms_user_name}`}>
      <div className="space-y-4">
        <Input
          label="Mata Pelajaran"
          placeholder="Pisahkan dengan koma"
          value={mapel}
          onChange={(e) => setMapel(e.target.value)}
        />
        <Input
          label="Kelas"
          placeholder="Pisahkan dengan koma"
          value={kelas}
          onChange={(e) => setKelas(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Simpan</Button>
        </div>
      </div>
    </Modal>
  )
}

function AcademicYearModal({
  institution,
  onClose,
  onSuccess,
}: {
  institution: Institution
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [academicYear, setAcademicYear] = useState(institution.academic_year_active || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/api/institution/${institution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_year_active: academicYear }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Tahun ajaran berhasil diperbarui")
        onSuccess()
      } else {
        toast.error(data.error || "Gagal memperbarui tahun ajaran")
      }
    } catch {
      toast.error("Gagal memperbarui tahun ajaran")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Kelola Tahun Ajaran">
      <div className="space-y-4">
        <Input
          label="Tahun Ajaran Aktif"
          required
          placeholder="Contoh: 2025/2026"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          helperText="Ubah tahun ajaran aktif untuk institusi ini."
        />
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
          <p className="font-medium mb-1">Tutup Tahun Ajaran</p>
          <p className="text-xs">Untuk menutup tahun ajaran, data periode sebelumnya akan tetap tersimpan dan tidak dihapus. Data baru akan menggunakan tahun ajaran yang baru.</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Simpan</Button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// Sprint 4.1 — Kartu ekspor file Dapodik (Excel, import manual ke Dapodik)
function DapodikExportCard({ institutionId, academicYear }: { institutionId: number; academicYear: string }) {
  const [semester, setSemester] = useState<"ganjil" | "genap">("ganjil");
  const [version, setVersion] = useState<string>("2025");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams({
        institutionId: String(institutionId),
        semester,
        tahunAjaran: academicYear,
        version,
      });
      const res = await apiFetch(`/api/export/dapodik?${qs.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Gagal mengekspor file");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dapodik_${institutionId}_${academicYear.replace("/", "-")}_${semester}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Terjadi kesalahan saat mengekspor");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">📤</span>
        <div>
          <h3 className="font-bold text-gray-900">Ekspor ke Dapodik</h3>
          <p className="text-xs text-gray-500">Generate file Excel lalu import manual ke aplikasi Dapodik.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <Label>Semester</Label>
          <Select value={semester} onChange={(e: any) => setSemester(e.target.value)}>
            <option value="ganjil">Ganjil</option>
            <option value="genap">Genap</option>
          </Select>
        </div>
        <div>
          <Label>Versi Dapodik</Label>
          <Select value={version} onChange={(e: any) => setVersion(e.target.value)}>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </Select>
        </div>
      </div>
      <Button variant="primary" size="md" onClick={handleExport} disabled={exporting}>
        {exporting ? "Membuat file..." : "Ekspor Sekarang"}
      </Button>
      <p className="text-[11px] text-gray-400 mt-2">
        File berisi Data PTK, Rekap TPG, dan Presensi. Import melalui menu Impor pada Dapodik.
      </p>
    </Card>
  )
}
