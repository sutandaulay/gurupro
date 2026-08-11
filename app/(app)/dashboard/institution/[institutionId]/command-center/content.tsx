"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  IconUsers,
  IconSchool,
  IconFileText,
  IconAlertTriangle,
  IconRefresh,
  IconChevronDown,
} from "@tabler/icons-react";

// =====================================================
// Command Center — Executive Dashboard Kepsek/Wakasek
// Satu layar = satu keputusan. Angka besar + status warna,
// progressive disclosure (detail di balik expand).
// Mobile-first.
// =====================================================

interface CommandCenterData {
  featureEnabled: boolean;
  ts: string;
  message?: string;
  kehadiranGuru: {
    totalGuru: number;
    present: number;
    telat: number;
    izin: number;
    sakit: number;
    alpa: number;
    belumAbsen: number;
    presentRate: number;
  };
  kehadiranSiswa: {
    totalSiswa: number;
    hadir: number;
    byStatus: Record<string, number>;
    presentRate: number;
  };
  administrasi: {
    totalDokumen: number;
    dokumenPendingApproval: number;
    guruBelumSubmitRpp: { id: string; nama: string }[];
  };
  insiden: {
    guruTelatBerulang: { id: string; nama: string; jumlahTelat: number }[];
    guruBelumTerassign: { id: string; nama: string }[];
    raportMendekatiDeadline: number;
  };
  strukturStaf: Record<string, number>;
}

function rateColor(rate: number): { text: string; bar: string; badge: string } {
  if (rate >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
  if (rate >= 50) return { text: "text-amber-600", bar: "bg-amber-500", badge: "bg-amber-100 text-amber-700" };
  return { text: "text-red-600", bar: "bg-red-500", badge: "bg-red-100 text-red-700" };
}

const ROLE_LABELS: Record<string, string> = {
  kepala_sekolah: "Kepala Sekolah",
  wakasek: "Wakasek",
  operator: "Operator",
  admin_sekolah: "Admin Sekolah",
  bendahara: "Bendahara",
  guru: "Guru",
};

export default function CommandCenterContent() {
  const params = useParams();
  const institutionId = params.institutionId as string;

  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/institution/${institutionId}/command-center`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Gagal memuat data");
      } else {
        setData(j);
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: string) => setExpanded((prev) => (prev === key ? null : key));

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Memuat Command Center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-gray-500">Belum ada data.</p>
      </div>
    );
  }

  if (data.featureEnabled === false) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-md mx-auto mt-10">
        <IconAlertTriangle className="mx-auto text-amber-500 mb-3" size={36} stroke={1.5} />
        <p className="font-semibold text-gray-900">Command Center belum aktif</p>
        <p className="text-sm text-gray-500 mt-1">{data.message || "Aktifkan lewat feature flag per institusi."}</p>
      </div>
    );
  }

  const kg = data.kehadiranGuru;
  const ks = data.kehadiranSiswa;
  const insidenCount =
    data.insiden.guruTelatBerulang.length +
    data.insiden.guruBelumTerassign.length +
    (data.insiden.raportMendekatiDeadline > 0 ? 1 : 0) +
    data.administrasi.guruBelumSubmitRpp.length;

  const guruColor = rateColor(kg.presentRate);
  const siswaColor = rateColor(ks.presentRate);

  return (
    <div className="space-y-5">
      {/* Header aksi */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ringkasan kondisi sekolah hari ini • diperbarui {new Date(data.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer"
          type="button"
        >
          <IconRefresh size={14} />
          Segarkan
        </button>
      </div>

      {/* Banner status keseluruhan */}
      <Banner insidenCount={insidenCount} />

      {/* Kartu angka besar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStatCard
          icon={<IconUsers size={20} stroke={1.5} />}
          label="Kehadiran Guru"
          value={`${kg.present + kg.telat}/${kg.totalGuru}`}
          rate={kg.presentRate}
          sub={`telat ${kg.telat} • belum absen ${kg.belumAbsen}`}
          onExpand={kg.totalGuru > 0 ? () => toggle("guru") : undefined}
          expanded={expanded === "guru"}
        />
        <BigStatCard
          icon={<IconSchool size={20} stroke={1.5} />}
          label="Kehadiran Siswa"
          value={`${ks.hadir}/${ks.totalSiswa}`}
          rate={ks.presentRate}
          sub="hari ini"
          onExpand={ks.totalSiswa > 0 ? () => toggle("siswa") : undefined}
          expanded={expanded === "siswa"}
        />
        <BigStatCard
          icon={<IconFileText size={20} stroke={1.5} />}
          label="RPP Perlu Perhatian"
          value={String(data.administrasi.guruBelumSubmitRpp.length)}
          rate={
            data.administrasi.guruBelumSubmitRpp.length === 0
              ? 100
              : Math.max(0, 100 - data.administrasi.guruBelumSubmitRpp.length * 10)
          }
          sub={`${data.administrasi.dokumenPendingApproval} dok. pending review`}
          onExpand={data.administrasi.guruBelumSubmitRpp.length > 0 ? () => toggle("rpp") : undefined}
          expanded={expanded === "rpp"}
        />
        <BigStatCard
          icon={<IconAlertTriangle size={20} stroke={1.5} />}
          label="Butuh Perhatian"
          value={String(insidenCount)}
          rate={insidenCount === 0 ? 100 : insidenCount >= 5 ? 0 : 50}
          sub={`${data.insiden.guruTelatBerulang.length} telat • ${data.insiden.guruBelumTerassign.length} belum assign`}
          onExpand={insidenCount > 0 ? () => toggle("insiden") : undefined}
          expanded={expanded === "insiden"}
        />
      </div>

      {/* Progressive disclosure */}
      {expanded === "guru" && kg.totalGuru > 0 && (
        <ExpandableCard title="Detail Kehadiran Guru Hari Ini" onClose={() => setExpanded(null)}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
            <MiniStat label="Hadir" value={kg.present} tone="emerald" />
            <MiniStat label="Telat" value={kg.telat} tone="amber" />
            <MiniStat label="Izin" value={kg.izin} tone="sky" />
            <MiniStat label="Sakit" value={kg.sakit} tone="violet" />
            <MiniStat label="Alpa" value={kg.alpa} tone="red" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Belum absen: <strong>{kg.belumAbsen}</strong> guru
          </p>
        </ExpandableCard>
      )}

      {expanded === "siswa" && ks.totalSiswa > 0 && (
        <ExpandableCard title="Detail Kehadiran Siswa Hari Ini" onClose={() => setExpanded(null)}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <MiniStat label="Hadir" value={ks.hadir} tone="emerald" />
            <MiniStat label="Izin" value={ks.byStatus["izin"] || 0} tone="sky" />
            <MiniStat label="Sakit" value={ks.byStatus["sakit"] || 0} tone="violet" />
            <MiniStat label="Alpa" value={ks.byStatus["alpa"] || 0} tone="red" />
          </div>
        </ExpandableCard>
      )}

      {expanded === "rpp" && data.administrasi.guruBelumSubmitRpp.length > 0 && (
        <ExpandableCard title="Guru Belum Mengumpulkan RPP/Modul" onClose={() => setExpanded(null)}>
          <NameList rows={data.administrasi.guruBelumSubmitRpp.map((g) => ({ nama: g.nama }))} />
        </ExpandableCard>
      )}

      {expanded === "insiden" && insidenCount > 0 && (
        <InsidenPanel data={data} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function Banner({ insidenCount }: { insidenCount: number }) {
  if (insidenCount === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        Semua berjalan normal hari ini. Tidak ada insiden yang membutuhkan perhatian.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
      <IconAlertTriangle size={18} className="shrink-0" />
      {insidenCount} hal butuh perhatian hari ini. Ketuk kartu untuk detail.
    </div>
  );
}

function BigStatCard({
  icon,
  label,
  value,
  rate,
  sub,
  onExpand,
  expanded,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  rate: number;
  sub: string;
  onExpand?: () => void;
  expanded?: boolean;
}) {
  const c = rateColor(rate);
  return (
    <button
      onClick={onExpand}
      type="button"
      disabled={!onExpand}
      className={`bg-white border rounded-2xl p-4 text-left transition ${expanded ? "border-violet-300 ring-2 ring-violet-100" : "border-gray-200"} ${onExpand ? "hover:border-violet-300 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.badge}`}>
          {icon}
        </span>
        {onExpand && (
          <IconChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </div>
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{value}</p>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5 truncate">{sub}</p>
    </button>
  );
}

function ExpandableCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-900">{title}</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer" type="button">
          Tutup
        </button>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    sky: "text-sky-600 bg-sky-50",
    violet: "text-violet-600 bg-violet-50",
    red: "text-red-600 bg-red-50",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] mt-0.5">{label}</p>
    </div>
  );
}

function NameList({ rows }: { rows: { nama: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
          <span className="font-medium text-gray-700">{r.nama}</span>
        </li>
      ))}
    </ul>
  );
}

function InsidenPanel({ data, onClose }: { data: CommandCenterData; onClose: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-900">Insiden yang Butuh Perhatian</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer" type="button">
          Tutup
        </button>
      </div>
      <div className="space-y-3">
        {data.insiden.guruBelumTerassign.length > 0 && (
          <AlertRow
            tone="red"
            title={`${data.insiden.guruBelumTerassign.length} guru belum terassigned kelas/mapel`}
            body="Guru tanpa assignment berpotensi error di presensi & raport. Assign lewat menu Manajemen Guru."
          >
            <NameList rows={data.insiden.guruBelumTerassign.map((g) => ({ nama: g.nama }))} />
          </AlertRow>
        )}
        {data.insiden.guruTelatBerulang.length > 0 && (
          <AlertRow
            tone="amber"
            title={`${data.insiden.guruTelatBerulang.length} guru telat berulang (≥3x minggu ini)`}
            body="Frekuensi telat tinggi. Perlu teguran atau pemantauan lebih dekat."
          >
            <NameList rows={data.insiden.guruTelatBerulang.map((g) => ({ nama: `${g.nama} (${g.jumlahTelat}x)` }))} />
          </AlertRow>
        )}
        {data.insiden.raportMendekatiDeadline > 0 && (
          <AlertRow
            tone="amber"
            title={`${data.insiden.raportMendekatiDeadline} raport belum finalisasi`}
            body="Raport masih di tahap draft / menunggu wali kelas."
          />
        )}
        {data.administrasi.guruBelumSubmitRpp.length > 0 && (
          <AlertRow
            tone="amber"
            title={`${data.administrasi.guruBelumSubmitRpp.length} guru belum mengumpulkan RPP/modul`}
            body="Dokumen administrasi belum tersedia untuk guru berikut."
          >
            <NameList rows={data.administrasi.guruBelumSubmitRpp.map((g) => ({ nama: g.nama }))} />
          </AlertRow>
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 mb-2">Struktur Staf</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.strukturStaf).map(([role, count]) => (
            <span key={role} className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
              <strong className="text-gray-800">{count}</strong>
              <span className="text-gray-500">{ROLE_LABELS[role] || role}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertRow({
  tone,
  title,
  body,
  children,
}: {
  tone: "red" | "amber";
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const toneCls =
    tone === "red"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-amber-50 border-amber-200 text-amber-800";
  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs mt-0.5 opacity-80">{body}</p>
      {children && <div className="mt-2 text-amber-900">{children}</div>}
    </div>
  );
}