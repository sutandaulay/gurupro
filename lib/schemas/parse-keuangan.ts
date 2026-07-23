import { z } from 'zod';
import { truncateText } from '@/lib/ai/validation-utils';

export const KeuanganKategoriEnum = z.enum([
  'Gaji',
  'Honor',
  'ATK',
  'Transport',
  'Konsumsi',
  'Sampingan',
  'Lainnya',
]);

export const KeuanganTipeEnum = z.enum(['pemasukan', 'pengeluaran']);

export const ParseKeuanganOutputSchema = z.object({
  jumlah: z.number().int().positive().max(1000000000),
  tipe: KeuanganTipeEnum,
  kategori: KeuanganKategoriEnum,
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  keterangan: z.string().max(200).transform(val => truncateText(val, 200)),
});

export type ParseKeuanganOutput = z.infer<typeof ParseKeuanganOutputSchema>;
