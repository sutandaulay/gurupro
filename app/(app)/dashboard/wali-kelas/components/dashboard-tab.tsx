'use client';
import type { WaliKelasDashboardData } from './types';
import { LoadingState, ErrorState, EmptyState } from './status';

interface DashboardTabProps {
  data: WaliKelasDashboardData | null;
  loading: boolean;
  error: string | null;
  onNavigate: (patch: { tab: string; siswa?: string | null }) => void;
}

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function WarningItem({
  nama,
  absen,
  detail,
  actionLabel,
  onAction,
}: {
  nama: string;
  absen: number | null;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 p-3 bg-white border rounded-lg">
      <div className="min-w-0">
        <p className="font-medium truncate">
          {absen != null ? `${absen}. ` : ''}
          {nama}
        </p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
      <button
        onClick={onAction}
        className="shrink-0 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        {actionLabel}
      </button>
    </li>
  );
}

export default function DashboardTab({ data, loading, error, onNavigate }: DashboardTabProps) {
  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const { kelas, periode, siswa, statistik, sikap, catatan } = data;

  const tanpaSikap = siswa.filter((s) => !s.status.sikapTerisi);
  const tanpaCatatan = siswa.filter((s) => !s.status.catatanTerisi);
  const adaAlpa = siswa.filter((s) => s.status.presensi.alpa > 0);

  const sikapPenuh = statistik.totalSiswa > 0 && statistik.sikapTerisi === statistik.totalSiswa;
  const catatanPenuh = statistik.totalSiswa > 0 && statistik.catatanTerisi === statistik.totalSiswa;

  return (
    <div className="space-y-6">
      {/* Info kelas & periode */}
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{kelas.nama_kelas}</h2>
        <p className="text-sm text-gray-500">
          Periode: <span className="font-medium text-gray-700">{periode}</span>
        </p>
        <p className="text-sm text-gray-500">
          Wali Kelas: <span className="font-medium text-gray-700">{kelas.wali_kelas || '-'}</span>
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Siswa"
          value={String(statistik.totalSiswa)}
          color="text-gray-900"
        />
        <StatCard
          label="Penilaian Sikap Terisi"
          value={`${statistik.sikapTerisi}/${statistik.totalSiswa}`}
          hint={sikapPenuh ? 'Lengkap' : `${tanpaSikap.length} siswa belum diisi`}
          color={sikapPenuh ? 'text-green-600' : 'text-amber-600'}
        />
        <StatCard
          label="Catatan Wali Kelas Terisi"
          value={`${statistik.catatanTerisi}/${statistik.totalSiswa}`}
          hint={catatanPenuh ? 'Lengkap' : `${tanpaCatatan.length} siswa belum diisi`}
          color={catatanPenuh ? 'text-green-600' : 'text-amber-600'}
        />
        <StatCard
          label="Rekap Presensi"
          value={`${statistik.totalPresensi.sakit} S / ${statistik.totalPresensi.izin} I / ${statistik.totalPresensi.alpa} A`}
          hint={adaAlpa.length > 0 ? `${adaAlpa.length} siswa memiliki alpa` : 'Tidak ada alpa'}
          color={adaAlpa.length > 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>

      {/* Peringatan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Perlu Perhatian - Belum Ada Penilaian Sikap
          </h3>
          {tanpaSikap.length === 0 ? (
            <EmptyState message="Semua siswa sudah memiliki penilaian sikap." />
          ) : (
            <ul className="space-y-2">
              {tanpaSikap.slice(0, 10).map((s) => (
                <WarningItem
                  key={s.id}
                  nama={s.nama_siswa}
                  absen={s.nomor_absen}
                  detail={`Catatan: ${catatan.some((c) => c.siswaId === s.id) ? 'ada' : 'belum'}`}
                  actionLabel="Isi Sikap"
                  onAction={() => onNavigate({ tab: 'siswa', siswa: s.id })}
                />
              ))}
              {tanpaSikap.length > 10 && (
                <li className="text-sm text-gray-500">
                  ...dan {tanpaSikap.length - 10} siswa lainnya
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Perlu Perhatian - Belum Ada Catatan Wali Kelas
          </h3>
          {tanpaCatatan.length === 0 ? (
            <EmptyState message="Semua siswa sudah memiliki catatan wali kelas." />
          ) : (
            <ul className="space-y-2">
              {tanpaCatatan.slice(0, 10).map((s) => (
                <WarningItem
                  key={s.id}
                  nama={s.nama_siswa}
                  absen={s.nomor_absen}
                  detail={`Sikap: ${sikap.some((sk) => sk.siswaId === s.id) ? 'ada' : 'belum'}`}
                  actionLabel="Tulis Catatan"
                  onAction={() => onNavigate({ tab: 'catatan', siswa: s.id })}
                />
              ))}
              {tanpaCatatan.length > 10 && (
                <li className="text-sm text-gray-500">
                  ...dan {tanpaCatatan.length - 10} siswa lainnya
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Siswa dengan alpa */}
      {adaAlpa.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Siswa dengan Alpa</h3>
          <ul className="space-y-2">
            {adaAlpa.slice(0, 10).map((s) => (
              <WarningItem
                key={s.id}
                nama={s.nama_siswa}
                absen={s.nomor_absen}
                detail={`Alpa: ${s.status.presensi.alpa} hari`}
                actionLabel="Lihat Detail"
                onAction={() => onNavigate({ tab: 'siswa', siswa: s.id })}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
