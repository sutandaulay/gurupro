"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { Card, Spinner } from "@/app/components/ui";
import { Input } from "@/app/components/ui/form";
import { useToast } from "@/app/components/ui/toast";
import { IconBuilding, IconAlertCircle, IconCheck } from "@tabler/icons-react";

export default function PengaturanPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const toast = useToast();
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    npsn: "",
    jenjang: "",
    naungan: "",
    academic_year_active: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  useEffect(() => {
    if (!institutionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/institution/${institutionId}`);
        if (res.ok) {
          const data = await res.json();
          setForm({
            name: data.name || "",
            npsn: data.npsn || "",
            jenjang: data.jenjang || "",
            naungan: data.naungan || "",
            academic_year_active: data.academic_year_active || "",
          });
        }
      } catch {
        setError("Gagal memuat data institusi.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [institutionId]);

  const handleSave = async () => {
    if (!institutionId) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/institution/${institutionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year_active: form.academic_year_active,
        }),
      });
      if (res.ok) {
        toast.success("Pengaturan berhasil disimpan.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menyimpan.");
      }
    } catch {
      toast.error("Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Institusi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola profil dan konfigurasi institusi.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <IconAlertCircle size={16} />
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <IconBuilding size={20} className="text-violet-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profil Institusi</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            label="Nama Institusi"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled
            helperText="Hubungi admin untuk mengubah nama."
          />
          <Input
            label="NPSN"
            value={form.npsn}
            onChange={(e) => setForm((f) => ({ ...f, npsn: e.target.value }))}
            disabled
            helperText="Hubungi admin untuk mengubah NPSN."
          />
          <Input
            label="Jenjang"
            value={form.jenjang}
            onChange={(e) => setForm((f) => ({ ...f, jenjang: e.target.value }))}
            disabled
          />
          <Input
            label="Naungan"
            value={form.naungan}
            onChange={(e) => setForm((f) => ({ ...f, naungan: e.target.value }))}
            disabled
          />
          <Input
            label="Tahun Ajaran Aktif"
            value={form.academic_year_active}
            onChange={(e) => setForm((f) => ({ ...f, academic_year_active: e.target.value }))}
            placeholder="Contoh: 2025/2026"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-200">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Zona Berbahaya</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tindakan di bawah ini tidak dapat dibatalkan. Hubungi administrator untuk perubahan kritis.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => toast.info("Fitur nonaktif. Hubungi administrator.")}
            className="px-4 py-2 border border-red-300 text-red-700 text-sm rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            Reset Token Poin
          </button>
          <button
            onClick={() => toast.info("Fitur nonaktif. Hubungi administrator.")}
            className="px-4 py-2 border border-red-300 text-red-700 text-sm rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            Nonaktifkan Institusi
          </button>
        </div>
      </Card>
    </div>
  );
}
