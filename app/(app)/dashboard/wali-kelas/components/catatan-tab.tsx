'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, usePagedItems } from '@/components/ui/pagination';
import CatatanWaliKelasForm from '@/app/components/CatatanWaliKelasForm';
import type { WaliKelasDashboardData } from './types';
import { LoadingState, ErrorState, EmptyState } from './status';

interface CatatanTabProps {
  data: WaliKelasDashboardData | null;
  loading: boolean;
  error: string | null;
  kelasId: string;
  periode: string;
  selectedSiswa: string | null;
  onSelectSiswa: (id: string | null) => void;
  onRefresh: () => void;
}

export default function CatatanTab({
  data,
  loading,
  error,
  kelasId,
  periode,
  selectedSiswa,
  onSelectSiswa,
  onRefresh,
}: CatatanTabProps) {
  const [editTarget, setEditTarget] = useState<{ id: string; nama: string; catatan: string } | null>(null);
  const [open, setOpen] = useState(false);
  const namaBySiswa = new Map((data?.siswa ?? []).map((s) => [s.id, s.nama_siswa]));
  const sortedCatatan = [...(data?.catatan ?? [])].sort((a, b) =>
    (namaBySiswa.get(a.siswaId) || '').localeCompare(namaBySiswa.get(b.siswaId) || '')
  );
  const catatanPager = usePagedItems(sortedCatatan, 25);

  useEffect(() => {
    if (selectedSiswa && data) {
      const s = data.siswa.find((x) => x.id === selectedSiswa);
      if (s) {
        const ct = data.catatan.find((c) => c.siswaId === selectedSiswa);
        setEditTarget({ id: s.id, nama: s.nama_siswa, catatan: ct?.catatan || '' });
        setOpen(true);
      }
    }
  }, [selectedSiswa, data]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const closeDialog = () => {
    setOpen(false);
    setEditTarget(null);
    onSelectSiswa(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Tulis Catatan Wali Kelas</h2>
        <CatatanWaliKelasForm
          kelasId={kelasId}
          periode={periode}
          onSuccess={onRefresh}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Riwayat Catatan</h2>
        {sortedCatatan.length === 0 ? (
          <EmptyState message="Belum ada catatan wali kelas untuk periode ini." />
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Nama Siswa</th>
                  <th className="px-3 py-2 font-medium">Catatan</th>
                  <th className="px-3 py-2 font-medium">Diperbarui</th>
                  <th className="px-3 py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {catatanPager.pagedItems.map((c, i) => (
                  <tr key={c.siswaId} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{i + 1 + (catatanPager.page - 1) * catatanPager.pageSize}</td>
                    <td className="px-3 py-2 font-medium">
                      {namaBySiswa.get(c.siswaId) || 'Siswa'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-md truncate">{c.catatan}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          setEditTarget({
                            id: c.siswaId,
                            nama: namaBySiswa.get(c.siswaId) || 'Siswa',
                            catatan: c.catatan,
                          });
                          setOpen(true);
                        }}
                        className="px-3 py-1 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {catatanPager.total > 0 && (
          <Pagination
            page={catatanPager.page}
            pageSize={catatanPager.pageSize}
            total={catatanPager.total}
            totalPages={catatanPager.totalPages}
            onPageChange={(p) => catatanPager.reset(p)}
            onPageSizeChange={(s) => {
              catatanPager.setPageSize(s);
              catatanPager.reset(1);
            }}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Catatan - {editTarget?.nama}</DialogTitle>
          </DialogHeader>
          <CatatanWaliKelasForm
            kelasId={kelasId}
            siswaId={editTarget?.id}
            periode={periode}
            existingCatatan={editTarget?.catatan}
            onSuccess={onRefresh}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
