"use client";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import VoiceBriefingPlayer from "@/components/voice/VoiceBriefingPlayer";

// =====================================================
// Dashboard KS — semua widget dari Tahap 3 + Tahap 4 + Tahap 5
// =====================================================

export default function ExecutiveDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [poinData, setPoinData] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ringkasan" | "raport" | "proses" | "staf" | "poin">("ringkasan");

  const loadCached = async (instId?: number) => {
    try {
      const qs = instId ? `?institutionId=${instId}` : "";
      const res = await apiFetch(`/api/executive-dashboard${qs}`, { cache: "no-store" });
      if (res.status === 403) { setError("Halaman ini hanya untuk Kepala Sekolah atau Wakasek."); return; }
      if (!res.ok) return;
      const d = await res.json();
      setInstitutions(d.institutions || []);
      setSelectedId(d.selectedInstitutionId || null);
      setData(d.dashboard);
    } catch { /* silent */ }
  };

  const loadLive = async (instId?: number) => {
    if (!instId) return;
    setLiveData(null);
    setPoinData(null);
    try {
      const [liveRes, poinRes] = await Promise.all([
        apiFetch(`/api/institution/${instId}/dashboard-live`),
        apiFetch(`/api/institution/${instId}/poin`),
      ]);
      if (liveRes.ok) setLiveData(await liveRes.json());
      if (poinRes.ok) setPoinData(await poinRes.json());
    } catch { /* silent */ }
  };

  const load = async (instId?: number) => {
    setLoading(true);
    setError(null);
    setData(null);
    setLiveData(null);
    try {
      await loadCached(instId);
      await loadLive(instId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSwitch = (id: number) => {
    setSelectedId(id);
    load(id);
  };

  const tabs = [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "raport", label: "Raport 3 Lapis" },
    { id: "proses", label: "Proses Mengajar" },
    { id: "staf", label: "Struktur Staf" },
    { id: "poin", label: "Poin" },
  ];

  const roleLabel: Record<string, string> = {
    kepala_sekolah: "Kepala Sekolah",
    wakasek: "Wakasek",
    operator: "Operator",
    admin_sekolah: "Admin Sekolah",
    bendahara: "Bendahara",
    guru: "Guru",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700 text-sm">← Kembali</button>
      </div>
      <h1 className="text-xl font-bold text-slate-800">Dasbor Kepala Sekolah</h1>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        {liveData ? "Data live •" : "Data cache •"} Klik tab di bawah untuk melihat detail.
      </p>

      {institutions.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {institutions.map((inst: any) => (
            <button
              key={inst.id}
              onClick={() => handleSwitch(inst.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                selectedId === inst.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              {inst.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Memuat dashboard...</p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      {!loading && !error && !data && !liveData && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <span className="text-3xl">⏳</span>
          <p className="text-sm text-slate-500 mt-2">Cache belum tersedia. Cron akan mengisi otomatis.</p>
        </div>
      )}

      {/* ============ TAB: RINGKASAN ============ */}
      {activeTab === "ringkasan" && (data || liveData) && (
        <div className="space-y-4">
          {/* Alert Panel */}
          {(liveData?.alerts?.guruBelumTerassign?.length > 0 || liveData?.alerts?.guruTelatBerulang?.length > 0 || data?.guruTelat3x?.length > 0) && (
            <AlertPanel
              guruBelumTerassign={liveData?.alerts?.guruBelumTerassign || data?.guruBelumTerassign || []}
              guruTelatBerulang={liveData?.alerts?.guruTelatBerulang || data?.guruTelat3x || []}
              raportDeadline={liveData?.raport?.mendekatiDeadline || data?.raportMendekatiDeadline || 0}
              onGuruClick={(id) => router.push(`/dashboard/institution/${selectedId}/aktivitas-guru`)}
            />
          )}

          {/* Kartu ringkasan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Guru Hadir Hari Ini"
              value={liveData ? `${liveData.kehadiran.hadirHariIni}/${liveData.kehadiran.totalGuru}` : `${data?.guruAktifMingguIni || 0}/${data?.totalGuru || 0}`}
              sub={liveData ? "data live" : "data minggu ini"}
              variant={liveData ? "live" : "cache"}
            />
            <StatCard
              label="Sesi Mengajar"
              value={data?.totalSesiMengajar || 0}
              sub="total minggu ini"
            />
            <StatCard
              label="Progress Kurikulum"
              value={`${data?.rataRataProgressKurikulum || 0}%`}
              sub="rata-rata ATP"
            />
            <StatCard
              label="Completion Rate"
              value={`${data?.completionRateSelesaiMengajar || 0}%`}
              sub="guru sudah mengajar"
            />
          </div>

          {/* Progress per mapel */}
          {data?.progressPerMapel?.length > 0 && (
            <SectionCard title="Progress Kurikulum per Mapel">
              <div className="space-y-3">
                {data.progressPerMapel.map((m: any) => (
                  <div key={m.mapel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{m.mapel}</span>
                      <span className="text-slate-500">{m.persen}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.persen >= 75 ? "bg-green-500" : m.persen >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${m.persen}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Top Guru */}
          {data?.topGuru?.length > 0 && (
            <SectionCard title="Guru Paling Aktif">
              <div className="space-y-2">
                {data.topGuru.map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      <span className="font-medium text-slate-700">{g.nama}</span>
                    </div>
                    <span className="text-slate-500">{g.sesi} sesi</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Laporan Terbaru */}
          {data?.latestLaporanMengajar?.length > 0 && (
            <SectionCard
              title="Laporan Mengajar Terbaru"
              action={
                <button onClick={() => router.push(`/dashboard/institution/${selectedId}/laporan-mengajar`)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Lihat Semua →
                </button>
              }
            >
              <div className="space-y-2">
                {data.latestLaporanMengajar.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium text-slate-700">{r.guru_nama}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-slate-500">{r.mapel}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-slate-500">{r.kelas}</span>
                    </div>
                    <span className="text-xs text-slate-400">{r.tanggal}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ============ TAB: RAPORT 3 LAPIS ============ */}
      {activeTab === "raport" && (data || liveData) && (
        <div className="space-y-4">
          <Raport3LapisWidget
            raportStats={liveData?.raport || data?.raportStats || {}}
            raportMingguIni={data?.raportMingguIni || []}
            raportMendekatiDeadline={liveData?.raport?.mendekatiDeadline || data?.raportMendekatiDeadline || 0}
            onClick={() => router.push("/dashboard/rapor-review")}
          />
        </div>
      )}

      {/* ============ TAB: PROSES MENGAJAR ============ */}
      {activeTab === "proses" && data && (
        <div className="space-y-4">
          {/* Engagement Platform */}
          {data.engagementPlatform?.guruBulanIni?.length > 0 && (
            <SectionCard title="Log Engagement Platform (Bulan Ini)">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 text-xs text-slate-500 font-medium">Guru</th>
                      <th className="text-center py-2 px-2 text-xs text-slate-500 font-medium">Raport Submit</th>
                      <th className="text-center py-2 px-2 text-xs text-slate-500 font-medium">Jurnal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.engagementPlatform.guruBulanIni.map((g: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-2 font-medium text-slate-700">{g.nama}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${g.raportSubmit > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                            {g.raportSubmit}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                            {g.jurnalCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Observasi Terbaru */}
          {data.observasiTerbaru?.length > 0 && (
            <SectionCard
              title={`Riwayat Observasi (${data.observasiTerbaru.length})`}
              action={
                data.observasiPending > 0 ? (
                  <span className="text-xs text-amber-600 font-medium">⚠ {data.observasiPending} pending</span>
                ) : undefined
              }
            >
              <div className="space-y-3">
                {data.observasiTerbaru.map((o: any) => (
                  <div key={o.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-slate-800">{o.guruNama}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{o.tanggal} • {o.observer}</p>
                      {o.catatan && <p className="text-xs text-slate-400 mt-1 italic">&quot;{o.catatan.substring(0, 100)}&quot;</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        o.skor >= 4 ? "bg-green-100 text-green-700" : o.skor >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>
                        {o.skor}
                      </span>
                      <span className="text-[10px] text-slate-400">/5</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {(!data.engagementPlatform?.guruBulanIni?.length && !data.observasiTerbaru?.length) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-500">Belum ada data proses mengajar.</p>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB: STRUKTUR STAF ============ */}
      {activeTab === "staf" && data && (
        <div className="space-y-4">
          <SectionCard title="Struktur Staf">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.strukturStaf || {}).map(([role, count]) => (
                <div key={role} className="p-3 bg-slate-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-slate-800">{count as number}</p>
                  <p className="text-xs text-slate-500 mt-1">{roleLabel[role] || role}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Sub-roles */}
          {Object.keys(data.subRoles || {}).length > 0 && (
            <SectionCard title="Sub-Role">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.subRoles).map(([role, info]: [string, any]) => (
                  <div key={role} className="p-3 bg-indigo-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-indigo-700">{info.jumlah}</p>
                    <p className="text-xs text-indigo-500 mt-1">{info.label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Guru Belum Terassign */}
          {data.guruBelumTerassign?.length > 0 && (
            <SectionCard title="⚠️ Guru Belum Terassign">
              <div className="space-y-2">
                {data.guruBelumTerassign.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                    <span className="text-sm text-amber-800">{g.nama}</span>
                    <button
                      onClick={() => router.push(`/dashboard/institution/${selectedId}/operator`)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Assign →
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ============ TAB: POIN ============ */}
      {activeTab === "poin" && (poinData || liveData) && (
        <div className="space-y-4">
          <SectionCard title="Voice Briefing & Poin">
            <div className="text-xs text-slate-500 mb-4">
              Voice Briefing aktif secara realtime untuk akun Anda.
            </div>
            {(session as any)?.user?.id && <VoiceBriefingPlayer userId={(session as any).user.id as string} />}
          </SectionCard>

          {!poinData?.available && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-500">Data Poin belum tersedia untuk institusi ini.</p>
            </div>
          )}

          {poinData?.available && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {poinData.saldo !== null && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-[11px] text-slate-500 font-medium">Saldo Poin</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{poinData.saldo.toLocaleString('id-ID')}</p>
                    {poinData.proyeksiHariHabis !== null && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Proyeksi habis: ~{poinData.proyeksiHariHabis} hari
                      </p>
                    )}
                  </div>
                )}
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <p className="text-[11px] text-slate-500 font-medium">Total Terpakai (60 hr)</p>
                  <p className="text-2xl font-bold text-slate-700 mt-1">{poinData.totalPoinDigunakan?.toLocaleString('id-ID')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Rata-rata: {poinData.rataPerHari?.toLocaleString('id-ID')} Poin/hari</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <p className="text-[11px] text-slate-500 font-medium">Total Transaksi</p>
                  <p className="text-2xl font-bold text-slate-700 mt-1">{poinData.totalTransaksi?.toLocaleString('id-ID')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">60 hari terakhir</p>
                </div>
              </div>

              {/* Breakdown per fitur */}
              <SectionCard title="Konsumsi Poin per Fitur (60 Hari)">
                {poinData.breakdown?.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Belum ada data.</p>
                ) : (
                  <div className="space-y-3">
                    {poinData.breakdown.map((b: any) => (
                      <div key={b.fitur}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{b.label}</span>
                          <span className="text-slate-600">{b.totalPoin.toLocaleString('id-ID')} Poin ({b.totalTransaksi}x)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(100, (b.totalPoin / (poinData.breakdown[0]?.totalPoin || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function StatCard({ label, value, sub, variant }: { label: string; value: string | number; sub: string; variant?: "live" | "cache" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
        {variant === "live" && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Data live" />}
      </div>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-slate-800">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function AlertPanel({
  guruBelumTerassign,
  guruTelatBerulang,
  raportDeadline,
  onGuruClick,
}: {
  guruBelumTerassign: any[];
  guruTelatBerulang: any[];
  raportDeadline: number;
  onGuruClick: (id: string) => void;
}) {
  const alerts: { type: string; emoji: string; title: string; body: string; action?: { label: string; onClick: () => void } }[] = [];

  if (guruTelatBerulang.length > 0) {
    alerts.push({
      type: "amber",
      emoji: "⏰",
      title: `${guruTelatBerulang.length} guru telat berulang`,
      body: `≥3x dalam seminggu ini. Segera tegur dan pantau.`,
      action: { label: "Lihat Guru", onClick: () => onGuruClick("telat") },
    });
  }
  if (guruBelumTerassign.length > 0) {
    alerts.push({
      type: "red",
      emoji: "⚠️",
      title: `${guruBelumTerassign.length} guru belum terassign`,
      body: "Guru belum mendapat kelas/mapel. Operasi raport & presensi berpotensi error.",
      action: { label: "Assign Sekarang", onClick: () => onGuruClick("unassigned") },
    });
  }
  if (raportDeadline > 0) {
    alerts.push({
      type: "amber",
      emoji: "📋",
      title: `${raportDeadline} raport mendekati deadline`,
      body: "Raport masih di tahap draft/dikirim. Reminder bisa dikirim ke guru terkait.",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
          a.type === "red" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{a.emoji}</span>
            <div>
              <p className={`text-sm font-semibold ${a.type === "red" ? "text-red-800" : "text-amber-800"}`}>{a.title}</p>
              <p className={`text-xs ${a.type === "red" ? "text-red-600" : "text-amber-600"}`}>{a.body}</p>
            </div>
          </div>
          {a.action && (
            <button
              onClick={a.action.onClick}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                a.type === "red" ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              {a.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Raport3LapisWidget({
  raportStats,
  raportMingguIni,
  raportMendekatiDeadline,
  onClick,
}: {
  raportStats: any;
  raportMingguIni: any[];
  raportMendekatiDeadline: number;
  onClick: () => void;
}) {
  const total = raportStats?.total || 0;
  const draft = raportStats?.draft || 0;
  const dikirim = raportStats?.dikirim_ke_wali_kelas || 0;
  const dikonfirmasi = raportStats?.dikonfirmasi || 0;
  const difinalisasi = raportStats?.difinalisasi || 0;
  const siap = raportStats?.siap_print || 0;

  const layers = [
    { label: "Draft", value: draft, color: "bg-slate-400", desc: "Guru sedang menyusun" },
    { label: "Dikirim ke WK", value: dikirim, color: "bg-amber-400", desc: "Menunggu konfirmasi Wali Kelas" },
    { label: "Dikonfirmasi WK", value: dikonfirmasi, color: "bg-indigo-400", desc: "Menunggu finalisasi KS" },
    { label: "Difinalisasi KS", value: difinalisasi, color: "bg-green-400", desc: "Siap dicetak" },
    { label: "Siap Print", value: siap, color: "bg-emerald-500", desc: "Selesai" },
  ];

  const maxVal = Math.max(...layers.map((l) => l.value), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-slate-800">e-Raport 3 Lapis — Posisi per Status</p>
        <button onClick={onClick} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
          Buka Rapor Review →
        </button>
      </div>

      {raportMendekatiDeadline > 0 && (
        <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 text-center">
          ⚠️ {raportMendekatiDeadline} raport mendekati deadline
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">Belum ada data raport.</div>
      ) : (
        <>
          <p className="text-sm text-slate-600 mb-3">Total: <strong>{total}</strong> raport</p>
          <div className="space-y-3">
            {layers.map((layer) => (
              <div key={layer.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">
                    {layer.label}
                    <span className="text-slate-400 ml-1">({layer.desc})</span>
                  </span>
                  <span className="text-slate-600 font-bold">{layer.value}</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${layer.color} rounded-full transition-all`}
                    style={{ width: `${Math.round((layer.value / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
