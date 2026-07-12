import { query } from '@/lib/db';
import {
  CreateKontakEksternalInputSchema,
  CreateKontakEksternalInput,
  StatusKlaimEnum,
} from './schemas';
import { generateShareToken } from '@/lib/performance-share';
import { getPayload } from '@/lib/payload';
import { COLLECTIONS } from '@/collections/config';

export const LINK_VALIDITY_HOURS = 72;

function getLinkExpiryDate(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + LINK_VALIDITY_HOURS);
  return expiry;
}

export async function createKontakEksternal(input: CreateKontakEksternalInput & { kontakWA?: string; kontakEmail?: string }) {
  const parsed = CreateKontakEksternalInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.message };
  }

  if (!input.kontakWA && !input.kontakEmail) {
    return { success: false as const, error: 'WA atau email wajib diisi' };
  }

  try {
    const linkToken = generateShareToken();
    const otpExpiredAt = input.otpExpiredAt || getLinkExpiryDate();

    const res = await query(
      `INSERT INTO kontak_eksternal_raport
         (guru_mapel_member_id, nama_kontak, kontak_wa, kontak_email, kelas_id, link_token, otp_expired_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [input.guruMapelMemberId, input.namaKontak, input.kontakWA || null, input.kontakEmail || null, input.kelasId, linkToken, otpExpiredAt]
    );

    return { success: true as const, id: res.rows[0].id, linkToken };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
}

export async function getKontakByLinkToken(linkToken: string) {
  const res = await query(
    `SELECT * FROM kontak_eksternal_raport WHERE link_token = $1`,
    [linkToken]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function getKontakById(id: string) {
  const res = await query(
    `SELECT * FROM kontak_eksternal_raport WHERE id = $1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function logAkses(kontakEksternalId: string, ipAddress?: string) {
  await query(
    `INSERT INTO kontak_eksternal_akses_log (kontak_eksternal_id, ip_address)
     VALUES ($1, $2)`,
    [kontakEksternalId, ipAddress || null]
  );
}

export async function getAksesLog(kontakEksternalId: string) {
  const res = await query(
    `SELECT * FROM kontak_eksternal_akses_log
     WHERE kontak_eksternal_id = $1
     ORDER BY accessed_at DESC`,
    [kontakEksternalId]
  );
  return res.rows;
}

export async function claimKontak(kontakId: string, claimedByMemberId: string) {
  const kontak = await getKontakById(kontakId);
  if (!kontak) {
    return { success: false as const, error: 'Kontak tidak ditemukan' };
  }

  if (kontak.status_klaim === 'sudah_klaim') {
    return { success: false as const, error: 'Kontak sudah diklaim' };
  }

  await query(
    `UPDATE kontak_eksternal_raport
     SET status_klaim = 'sudah_klaim', claimed_by_member_id = $1
     WHERE id = $2`,
    [claimedByMemberId, kontakId]
  );

  return { success: true as const };
}

export async function findKontakByWAOrEmail(
  wa: string,
  email: string,
  excludeKontakId?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (wa) {
    conditions.push(`kontak_wa = $${idx++}`);
    params.push(wa);
  }
  if (email) {
    conditions.push(`kontak_email = $${idx++}`);
    params.push(email);
  }

  if (conditions.length === 0) return [];

  let sql = `SELECT * FROM kontak_eksternal_raport WHERE (${conditions.join(' OR ')})`;
  if (excludeKontakId) {
    sql += ` AND id != $${idx}`;
    params.push(excludeKontakId);
  }
  sql += ` ORDER BY created_at DESC`;

  const res = await query(sql, params);
  return res.rows;
}

export async function getKontakByGuruMapel(guruMapelMemberId: string, kelasId?: string) {
  const conditions: string[] = ['guru_mapel_member_id = $1'];
  const params: any[] = [guruMapelMemberId];

  if (kelasId) {
    conditions.push(`kelas_id = $2`);
    params.push(kelasId);
  }

  const res = await query(
    `SELECT * FROM kontak_eksternal_raport WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return res.rows;
}

export async function getPemetaanKolomProfile(sekolahId: string, jalurRegulasi: string) {
  const res = await query(
    `SELECT * FROM pemetaan_kolom_profile WHERE sekolah_id = $1 AND jalur_regulasi = $2`,
    [sekolahId, jalurRegulasi]
  );
  return res.rows[0] || null;
}

export async function upsertPemetaanKolomProfile(input: {
  sekolahId: string;
  jalurRegulasi: string;
  urutanSiswa: string;
  urutanKolom: string[];
  systemVersionCatatan?: string;
}) {
  const existing = await getPemetaanKolomProfile(input.sekolahId, input.jalurRegulasi);

  if (existing) {
    await query(
      `UPDATE pemetaan_kolom_profile
       SET urutan_siswa = $1, urutan_kolom = $2::jsonb, system_version_catatan = $3, last_validated_at = now()
       WHERE id = $4`,
      [input.urutanSiswa, JSON.stringify(input.urutanKolom), input.systemVersionCatatan || null, existing.id]
    );
    return { success: true as const, id: existing.id };
  }

  const res = await query(
    `INSERT INTO pemetaan_kolom_profile (sekolah_id, jalur_regulasi, urutan_siswa, urutan_kolom, system_version_catatan)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [input.sekolahId, input.jalurRegulasi, input.urutanSiswa, JSON.stringify(input.urutanKolom), input.systemVersionCatatan || null]
  );

  return { success: true as const, id: res.rows[0].id };
}

export function isPemetaanProfileExpired(lastValidatedAt: Date | string): boolean {
  const satuTahunLalu = new Date();
  satuTahunLalu.setFullYear(satuTahunLalu.getFullYear() - 1);
  return new Date(lastValidatedAt) < satuTahunLalu;
}

export async function isOtpVerified(kontakId: string): Promise<boolean> {
  try {
    const payload = await getPayload();
    const otpRecords = await payload.find({
      collection: COLLECTIONS.OTP_VERIFICATIONS,
      where: {
        performanceShareLinkId: { equals: kontakId },
        verifiedAt: { exists: true },
      },
      sort: '-createdAt',
      limit: 1,
    });
    return otpRecords.docs.length > 0;
  } catch {
    return false;
  }
}

export async function getDataRaportForKelas(kelasId: string) {
  const res = await query(
    `SELECT dr.*, s.nama_siswa, s.nisn, s.nomor_absen,
            c.nama_kelas, tr.nama_template
     FROM data_raport dr
     JOIN students s ON s.id = dr.siswa_id
     JOIN classes c ON c.id = dr.kelas_id
     JOIN template_raport tr ON tr.id = dr.template_raport_id
     WHERE dr.kelas_id = $1
     ORDER BY s.nama_siswa ASC`,
    [kelasId]
  );
  return res.rows;
}

export async function getNilaiMapelForRaport(dataRaportId: string) {
  const res = await query(
    `SELECT dnrm.*, sb.nama_mapel
     FROM data_raport_nilai_mapel dnrm
     LEFT JOIN subjects sb ON sb.id = dnrm.mapel_id
     WHERE dnrm.data_raport_id = $1
     ORDER BY sb.nama_mapel ASC`,
    [dataRaportId]
  );
  return res.rows;
}
