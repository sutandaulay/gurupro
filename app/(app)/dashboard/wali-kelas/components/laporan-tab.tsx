'use client';
import { useState, Fragment } from 'react';
import { apiFetch } from "@/lib/api-client";
import { Pagination, usePagedItems } from '@/components/ui/pagination';
import type { WaliKelasDashboardData, RaportNilaiMapel } from './types';
import { SIKAP_VARIAN_LABEL, RAPORT_STATUS_LABEL, RAPORT_JENIS_LABEL } from './types';
import { LoadingState, ErrorState, EmptyState } from './status';

interface LaporanTabProps {
  data: WaliKelasDashboardData | null;
  loading: boolean;
  error: string | null;
  kelasId: string;
  periode: string;
  onRefresh: () => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'dikirim_ke_wali_kelas':
      return 'bg-blue-100 text-blue-700';
    case 'dikonfirmasi':
      return 'bg-green-100 text-green-700';
    case 'difinalisasi':
      return 'bg-purple-100 text-purple-700';
    case 'siap_print':
      return 'bg-teal-100 text-teal-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Aksi status yang boleh dilakukan WALI KELAS (bukan semua transisi).
 * Mengikuti TRANSISI_VALID di lib/raport/repository.ts, dipersempit ke
 * langkah yang jadi tanggung jawab wali kelas sebelum raport dibagikan.
 */
const WALI_KELAS_ACTIONS: Record<string, { label: string; target: string } | undefined> = {
  dikirim_ke_wali_kelas: { label: 'Konfirmasi', target: 'dikonfirmasi' },
  dikonfirmasi: { label: 'Finalisasi', target: 'difinalisasi' },
  difinalisasi: { label: 'Siap Print', target: 'siap_print' },
};

function KonfirmasiBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
      {label}
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
      {label}
    </span>
  );
}

function NilaiMapelTable({ nilaiMapel }: { nilaiMapel: RaportNilaiMapel[] }) {
  if (nilaiMapel.length === 0) {
    return (
      <p className="text-sm text-gray-500 p-3">
        Belum ada nilai mapel yang dikirim guru untuk raport ini.
      </p>
    );
  }
  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-3 py-2 font-medium">Mata Pelajaran</th>
            <th className="px-3 py-2 font-medium text-center">Nilai</th>
            <th className="px-3 py-2 font-medium text-center">KKM</th>
            <th className="px-3 py-2 font-medium">Guru Mapel</th>
            <th className="px-3 py-2 font-medium text-center">Konfirmasi Guru</th>
            <th className="px-3 py-2 font-medium">Deskripsi Capaian</th>
          </tr>
        </thead>
        <tbody>
          {nilaiMapel.map((nm) => (
            <tr key={nm.mapelId} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{nm.namaMapel}</td>
              <td className="px-3 py-2 text-center">
                <span className={nm.nilaiAkhir != null && nm.kkm != null && nm.nilaiAkhir < nm.kkm ? 'text-red-600 font-medium' : ''}>
                  {nm.nilaiAkhir ?? '-'}
                </span>
              </td>
              <td className="px-3 py-2 text-center">{nm.kkm ?? '-'}</td>
              <td className="px-3 py-2 text-gray-600">{nm.guruNama || '-'}</td>
              <td className="px-3 py-2 text-center">
                <KonfirmasiBadge
                  ok={nm.dikonfirmasiGuru}
                  label={nm.dikonfirmasiGuru ? 'Terkonfirmasi' : 'Belum'}
                />
              </td>
              <td className="px-3 py-2 max-w-sm text-gray-500 line-clamp-2">{nm.deskripsiCapaian || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LaporanTab({ data, loading, error, kelasId, periode, onRefresh }: LaporanTabProps) {
  const [expandedRaportId, setExpandedRaportId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const siswaPager = usePagedItems(data?.siswa ?? [], 25);
  const raportPager = usePagedItems(data?.raportStatus ?? [], 25);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const { siswa, sikap, catatan, kelas } = data;

  const sikapBySiswa = new Map(sikap.map((s) => [s.siswaId, s]));
  const catatanBySiswa = new Map(catatan.map((c) => [c.siswaId, c]));
  const namaBySiswa = new Map(siswa.map((s) => [s.id, s.nama_siswa]));

  const exportUrl = `/api/wali-kelas/dashboard/export?kelasId=${encodeURIComponent(kelasId)}&periode=${encodeURIComponent(periode)}`;

  const updateStatus = async (raportId: string, newStatus: string) => {
    setActionBusy(raportId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch('/api/raport/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_raport_id: raportId,
          new_status: newStatus,
          changed_by_role: 'wali_kelas',
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Gagal mengubah status raport');
      }
      setActionSuccess(`Status raport berhasil diubah menjadi "${RAPORT_STATUS_LABEL[newStatus] || newStatus}".`);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section A: Rekap Wali Kelas */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">A. Rekap Wali Kelas</h2>
            <p className="text-sm text-gray-500">
              Presensi, penilaian sikap, dan catatan wali kelas per siswa untuk periode {periode}.
            </p>
          </div>
          <a
            href={exportUrl}
            className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
          >
            Ekspor XLSX
          </a>
        </div>

        {siswa.length === 0 ? (
          <EmptyState message="Belum ada siswa di kelas ini." />
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Nama Siswa</th>
                  <th className="px-3 py-2 font-medium text-center">S/I/A</th>
                  <th className="px-3 py-2 font-medium">Sikap</th>
                  <th className="px-3 py-2 font-medium">Catatan Wali Kelas</th>
                </tr>
              </thead>
              <tbody>
                {siswaPager.pagedItems.map((s, i) => {
                  const sk = sikapBySiswa.get(s.id);
                  const ct = catatanBySiswa.get(s.id);
                  const rowNo = i + 1 + (siswaPager.page - 1) * siswaPager.pageSize;
                  return (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{rowNo}</td>
                      <td className="px-3 py-2 font-medium">
                        {s.nomor_absen != null ? `${s.nomor_absen}. ` : ''}
                        {s.nama_siswa}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-gray-700">
                          {s.status.presensi.sakit}/{s.status.presensi.izin}/
                          <span className={s.status.presensi.alpa > 0 ? 'text-red-600 font-medium' : ''}>
                            {s.status.presensi.alpa}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        {sk ? (
                          <div>
                            <p className="text-xs font-medium text-gray-600">
                              {SIKAP_VARIAN_LABEL[sk.varian] || sk.varian}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-2">{sk.deskripsiUmum}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        {ct ? (
                          <p className="text-gray-600 line-clamp-2">{ct.catatan}</p>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {siswaPager.total > 0 && (
          <Pagination
            page={siswaPager.page}
            pageSize={siswaPager.pageSize}
            total={siswaPager.total}
            totalPages={siswaPager.totalPages}
            onPageChange={(p) => siswaPager.reset(p)}
            onPageSizeChange={(s) => {
              siswaPager.setPageSize(s);
              siswaPager.reset(1);
            }}
          />
        )}
      </section>

      {/* Section B: Pratinjau & Pengelolaan Raport */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">B. Pratinjau &amp; Pengelolaan Raport</h2>
            <p className="text-sm text-gray-500">
              Nilai dari guru mapel + status raport siswa kelas {kelas.nama_kelas}. Wali kelas
              mengelola raport di sini: konfirmasi, finalisasi, hingga siap print/bagikan.
            </p>
          </div>
          <a
            href="/dashboard/raport-status"
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Kelola Status Raport
          </a>
        </div>

        {actionError && (
          <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mb-3 p-3 rounded border border-green-200 bg-green-50 text-green-700 text-sm">
            {actionSuccess}
          </div>
        )}

        {raportPager.total === 0 ? (
          <EmptyState message="Belum ada raport untuk periode ini." />
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Nama Siswa</th>
                  <th className="px-3 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Jenis Laporan</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Diperbarui</th>
                  <th className="px-3 py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {raportPager.pagedItems.map((r, i) => {
                  const action = WALI_KELAS_ACTIONS[r.status];
                  const rowNo = i + 1 + (raportPager.page - 1) * raportPager.pageSize;
                  return (
                    <Fragment key={r.raportId}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedRaportId(expandedRaportId === r.raportId ? null : r.raportId)}
                      >
                        <td className="px-3 py-2">{rowNo}</td>
                        <td className="px-3 py-2 font-medium">
                          {namaBySiswa.get(r.siswaId) || 'Siswa'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{r.namaTemplate || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {RAPORT_JENIS_LABEL[r.jenisLaporan] || r.jenisLaporan || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusBadgeClass(r.status)}`}>
                            {RAPORT_STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRaportId(expandedRaportId === r.raportId ? null : r.raportId);
                              }}
                              className="px-3 py-1 rounded text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                            >
                              {expandedRaportId === r.raportId ? 'Tutup' : 'Detail Nilai'}
                            </button>
                            {action && (
                              <button
                                disabled={actionBusy === r.raportId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(r.raportId, action.target);
                                }}
                                className="px-3 py-1 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {actionBusy === r.raportId ? 'Menyimpan...' : action.label}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRaportId === r.raportId && (
                        <tr className="border-t">
                          <td colSpan={7} className="px-3 py-3 bg-gray-50/50">
                            <NilaiMapelTable nilaiMapel={r.nilaiMapel} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {raportPager.total > 0 && (
          <Pagination
            page={raportPager.page}
            pageSize={raportPager.pageSize}
            total={raportPager.total}
            totalPages={raportPager.totalPages}
            onPageChange={(p) => raportPager.reset(p)}
            onPageSizeChange={(s) => {
              raportPager.setPageSize(s);
              raportPager.reset(1);
            }}
          />
        )}
      </section>
    </div>
  );
}
