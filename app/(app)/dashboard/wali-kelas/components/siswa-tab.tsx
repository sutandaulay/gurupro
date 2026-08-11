'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, usePagedItems } from '@/components/ui/pagination';
import PenilaianSikapForm from '@/app/components/PenilaianSikapForm';
import CatatanWaliKelasForm from '@/app/components/CatatanWaliKelasForm';
import type { WaliKelasDashboardData } from './types';
import { LoadingState, ErrorState, EmptyState } from './status';

interface SiswaTabProps {
  data: WaliKelasDashboardData | null;
  loading: boolean;
  error: string | null;
  kelasId: string;
  periode: string;
  selectedSiswa: string | null;
  onSelectSiswa: (id: string | null) => void;
  onRefresh: () => void;
}

export default function SiswaTab({
  data,
  loading,
  error,
  kelasId,
  periode,
  selectedSiswa,
  onSelectSiswa,
  onRefresh,
}: SiswaTabProps) {
  const [open, setOpen] = useState(false);
  const siswaPager = usePagedItems(data?.siswa ?? [], 25);

  useEffect(() => {
    if (selectedSiswa) {
      setOpen(true);
    }
  }, [selectedSiswa]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const { siswa, sikap, catatan } = data;

  const sikapBySiswa = new Map(sikap.map((s) => [s.siswaId, s]));
  const catatanBySiswa = new Map(catatan.map((c) => [c.siswaId, c]));
  const namaBySiswa = new Map(siswa.map((s) => [s.id, s.nama_siswa]));

  const selectedNama = selectedSiswa ? namaBySiswa.get(selectedSiswa) : undefined;
  const selectedSikap = selectedSiswa ? sikapBySiswa.get(selectedSiswa) : undefined;
  const selectedCatatan = selectedSiswa ? catatanBySiswa.get(selectedSiswa) : undefined;

  const closeDialog = () => {
    setOpen(false);
    onSelectSiswa(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Daftar Siswa</h2>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
        >
          Muat Ulang
        </button>
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
                <th className="px-3 py-2 font-medium">NISN</th>
                <th className="px-3 py-2 font-medium text-center">S/I/A</th>
                <th className="px-3 py-2 font-medium text-center">Sikap</th>
                <th className="px-3 py-2 font-medium text-center">Catatan</th>
                <th className="px-3 py-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {siswaPager.pagedItems.map((s, i) => {
                const sk = sikapBySiswa.get(s.id);
                const ct = catatanBySiswa.get(s.id);
                const rowNo = i + 1 + (siswaPager.page - 1) * siswaPager.pageSize;
                return (
                  <tr
                    key={s.id}
                    className="border-t cursor-pointer hover:bg-gray-50"
                    onClick={() => onSelectSiswa(s.id)}
                  >
                    <td className="px-3 py-2">{rowNo}</td>
                    <td className="px-3 py-2">
                      {s.nomor_absen != null ? `${s.nomor_absen}. ` : ''}
                      <span className="font-medium">{s.nama_siswa}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{s.nisn || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-gray-700">
                        {s.status.presensi.sakit}/{s.status.presensi.izin}/
                        <span className={s.status.presensi.alpa > 0 ? 'text-red-600 font-medium' : ''}>
                          {s.status.presensi.alpa}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {sk ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                          Terisi
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ct ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                          Terisi
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSiswa(s.id);
                        }}
                        className="px-3 py-1 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Isi Sikap &amp; Catatan
                      </button>
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

      <Dialog open={open} onOpenChange={(v) => (v ? null : closeDialog())}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Sikap &amp; Catatan - {selectedNama || 'Siswa'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <PenilaianSikapForm
              kelasId={kelasId}
              siswaId={selectedSiswa || undefined}
              periode={periode}
              existingData={
                selectedSikap
                  ? {
                      varian: selectedSikap.varian,
                      penilaianPerDimensi: selectedSikap.penilaianPerDimensi.map((p) => ({
                        dimensi: p.dimensi,
                        predikat: p.predikat as 'sangat_baik' | 'baik' | 'cukup' | 'perlu_bimbingan',
                      })),
                      deskripsiUmum: selectedSikap.deskripsiUmum,
                    }
                  : undefined
              }
              onSuccess={() => {
                onRefresh();
              }}
            />
            <CatatanWaliKelasForm
              kelasId={kelasId}
              siswaId={selectedSiswa || undefined}
              periode={periode}
              existingCatatan={selectedCatatan?.catatan}
              onSuccess={() => {
                onRefresh();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
