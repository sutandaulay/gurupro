"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback } from "react";
import { Button, Card, Badge, Spinner } from "@/app/components/ui";
import { Input, Label } from "@/app/components/ui/form";
import { useToast } from "@/app/components/ui/toast";
import { IconUsers, IconAlertCircle } from "@tabler/icons-react";

interface Member {
  id: number;
  app_user_id: string | null;
  institution_id: number;
  status: string;
  cms_user_name: string;
  cms_user_email: string;
  app_user_email: string | null;
  nama_lengkap: string | null;
  whatsapp: string | null;
  roles: { role: string }[];
  assigned_mapel: { mapel: string }[];
  assigned_kelas: { kelas: string }[];
  sub_role: string | null;
  wali_kelas_of: string | null;
  ekskul_name: string | null;
}

const roleLabel: Record<string, string> = {
  kepala_sekolah: "Kepsek",
  wakasek: "Wakasek",
  operator: "Operator",
  bendahara: "Bendahara",
  guru: "Guru",
};

export default function GuruManagementPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState<Member | null>(null);

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  const fetchData = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/institution/${institutionId}/members`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal memuat data");
        return;
      }
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    if (institutionId) fetchData();
  }, [institutionId, fetchData]);

  const activeMembers = members.filter((m) => m.status === "active");
  const invitedMembers = members.filter((m) => m.status === "invited");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Guru</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola guru, role, dan penugasan di institusi.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Total Guru Aktif</p>
          <p className="text-2xl font-bold mt-1 text-violet-600">{activeMembers.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Menunggu Konfirmasi</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{invitedMembers.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Nonaktif</p>
          <p className="text-2xl font-bold mt-1 text-gray-400">
            {members.filter((m) => m.status === "left").length}
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <IconAlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600">{error}</p>
        </Card>
      ) : members.length === 0 ? (
        <Card className="p-12 text-center">
          <IconUsers size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Belum ada guru di institusi ini.</p>
        </Card>
      ) : (
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
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.nama_lengkap || m.cms_user_name}</p>
                      {m.whatsapp && <p className="text-xs text-gray-400">{m.whatsapp}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{m.app_user_email || m.cms_user_email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.length > 0 ? m.roles.map((r, i) => (
                          <Badge key={i} variant="default">{roleLabel[r.role] || r.role}</Badge>
                        )) : <span className="text-gray-400 text-xs">—</span>}
                        {m.sub_role === "wali_kelas" && (
                          <Badge variant="info">WK ({m.wali_kelas_of || "—"})</Badge>
                        )}
                        {m.sub_role === "pembina_ekskul" && (
                          <Badge variant="warning">PE ({m.ekskul_name || "—"})</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.status === "active" ? "success" : m.status === "invited" ? "warning" : m.status === "left" ? "error" : "default"}>
                        {m.status === "active" ? "Aktif" : m.status === "invited" ? "Diundang" : m.status === "left" ? "Nonaktif" : m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.assigned_mapel.length > 0 ? m.assigned_mapel.map((a) => a.mapel).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.assigned_kelas.length > 0 ? m.assigned_kelas.map((a) => a.kelas).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setShowEditModal(m)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showEditModal && institutionId && (
        <EditModal
          member={showEditModal}
          institutionId={institutionId}
          onClose={() => setShowEditModal(null)}
          onSuccess={() => { setShowEditModal(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function EditModal({
  member,
  institutionId,
  onClose,
  onSuccess,
}: {
  member: Member;
  institutionId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [mapel, setMapel] = useState(member.assigned_mapel.map((a) => a.mapel).join(", "));
  const [kelas, setKelas] = useState(member.assigned_kelas.map((a) => a.kelas).join(", "));
  const [subRole, setSubRole] = useState(member.sub_role || "");
  const [waliKelasOf, setWaliKelasOf] = useState(member.wali_kelas_of || "");
  const [ekskulName, setEkskulName] = useState(member.ekskul_name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/institution/${institutionId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapel, kelas, subRole, waliKelasOf, ekskulName }),
      });
      if (res.ok) {
        toast.success("Assignment berhasil diperbarui");
        onSuccess();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Gagal memperbarui");
      }
    } catch {
      toast.error("Gagal memperbarui");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit: {member.nama_lengkap || member.cms_user_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-4">
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
          <div>
            <Label>Sub-Role</Label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-violet-400 focus:outline-none"
              value={subRole}
              onChange={(e) => setSubRole(e.target.value)}
            >
              <option value="">Tidak Ada</option>
              <option value="wali_kelas">Wali Kelas</option>
              <option value="pembina_ekskul">Pembina Ekskul</option>
            </select>
          </div>
          {subRole === "wali_kelas" && (
            <Input label="Kelas Wali" placeholder="Contoh: VII-A" value={waliKelasOf} onChange={(e) => setWaliKelasOf(e.target.value)} />
          )}
          {subRole === "pembina_ekskul" && (
            <Input label="Nama Ekskul" placeholder="Contoh: Pramuka" value={ekskulName} onChange={(e) => setEkskulName(e.target.value)} />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
