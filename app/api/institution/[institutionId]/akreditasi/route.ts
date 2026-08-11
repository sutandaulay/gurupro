import { NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";

// =====================================================
// Modul Akreditasi & Pengawasan — Kepala Sekolah & Wakasek
// Endpoint BARU + tabel BARU (akreditasi_standar/item/status).
// Menampilkan 8 standar akreditasi nasional + progres
// pemenuhan per institusi. Tidak menyentuh modul existing.
// Gate: flag akreditasi + RBAC leader.
// =====================================================

const LEADER_ROLES = ["kepala_sekolah", "wakasek"];

async function getLeaderRoles(appUserId: string, institutionId: number): Promise<string[]> {
  const res = await query(
    `SELECT imr.value AS role
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
       AND imr.value = ANY($3)
     GROUP BY imr.value`,
    [appUserId, institutionId, LEADER_ROLES]
  );
  return res.rows.map((r: any) => r.role);
}

// 8 standar akreditasi nasional (BAN-S/M / IASP2020)
const SEED_STANDAR = [
  { kode: "STD-1", nama: "Peserta Didik", urutan: 1 },
  { kode: "STD-2", nama: "Kinerja Guru", urutan: 2 },
  { kode: "STD-3", nama: "Kepemimpinan Kepala Sekolah", urutan: 3 },
  { kode: "STD-4", nama: "Kinerja Manajemen Sekolah", urutan: 4 },
  { kode: "STD-5", nama: "Budaya & Lingkungan Kerja", urutan: 5 },
  { kode: "STD-6", nama: "Peran Serta Masyarakat", urutan: 6 },
  { kode: "STD-7", nama: "Penerapan Kurikulum", urutan: 7 },
  { kode: "STD-8", nama: "Sistem Informasi & Keunggulan", urutan: 8 },
];

const SEED_ITEM: Record<string, string[]> = {
  "STD-1": ["Penerimaan peserta didik baru", "Layanan bimbingan konseling", "Data & progres perkembangan peserta didik"],
  "STD-2": ["Kualitas perencanaan pembelajaran", "Pelaksanaan pembelajaran", "Penilaian & pelaporan hasil belajar", "Pengembangan profesi guru"],
  "STD-3": ["Perumusan visi misi sekolah", "Keteladanan & komunikasi kepemimpinan", "Kepemimpinan pembelajaran (instructional leadership)"],
  "STD-4": ["Perencanaan & evaluasi program", "Pengelolaan sarana prasarana", "Pengelolaan keuangan & anggaran", "Pengelolaan kelembagaan & tata laksana"],
  "STD-5": ["Budaya kerja & disiplin", "Lingkungan belajar yang aman", "Iklim keamanan & kesejahteraan warga sekolah"],
  "STD-6": ["Kemitraan dengan orang tua", "Kemitraan dengan masyarakat & dunia usaha", "Peran komite sekolah"],
  "STD-7": ["Kelengkapan perangkat kurikulum", "Implementasi kurikulum dalam pembelajaran", "Asesmen kurikulum & tindak lanjut"],
  "STD-8": ["Pemanfaatan sistem informasi manajemen", "Keunggulan & inovasi sekolah", "Pengelolaan data untuk pengambilan keputusan"],
};

// Seed standar + item secara idempoten (hanya jika tabel kosong)
async function ensureAkreditasiSeed() {
  const check = await query(`SELECT COUNT(*)::int AS n FROM akreditasi_standar`);
  if (Number(check.rows[0]?.n || 0) > 0) return;

  for (const s of SEED_STANDAR) {
    const res = await query(
      `INSERT INTO akreditasi_standar (kode, nama, urutan)
       VALUES ($1, $2, $3) ON CONFLICT (kode) DO NOTHING RETURNING id`,
      [s.kode, s.nama, s.urutan]
    );
    let standarId = res.rows?.[0]?.id;
    if (!standarId) {
      const found = await query(`SELECT id FROM akreditasi_standar WHERE kode = $1`, [s.kode]);
      standarId = found.rows[0].id;
    }

    for (const item of SEED_ITEM[s.kode] || []) {
      const idx = SEED_ITEM[s.kode].indexOf(item);
      const kodeItem = `${s.kode}.${(idx + 1).toString().padStart(2, "0")}`;
      await query(
        `INSERT INTO akreditasi_item (standar_id, kode, nama, urutan)
         VALUES ($1, $2, $3, $4) ON CONFLICT (standar_id, kode) DO NOTHING`,
        [standarId, kodeItem, item, idx + 1]
      );
    }
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "akreditasi");
    if (!featureEnabled) {
      return NextResponse.json(
        { featureEnabled: false, message: "Modul Akreditasi belum aktif untuk institusi ini." },
        { status: 200 }
      );
    }

    await ensureAkreditasiSeed();

    const [standarRes, itemRes, statusRes] = await Promise.all([
      query(
        `SELECT id, kode, nama, urutan FROM akreditasi_standar
         WHERE is_active = TRUE ORDER BY urutan ASC`
      ),
      query(
        `SELECT id, standar_id, kode, nama FROM akreditasi_item
         WHERE is_active = TRUE ORDER BY urutan ASC`
      ),
      query(
        `SELECT item_id, status, catatan, updated_at
         FROM akreditasi_status WHERE institution_id = $1`,
        [instId]
      ),
    ]);

    const statusMap = new Map<string, any>();
    for (const r of statusRes.rows as any[]) {
      statusMap.set(r.item_id, { status: r.status, catatan: r.catatan, updated_at: r.updated_at });
    }

    const itemsByStandar = new Map<string, any[]>();
    for (const r of itemRes.rows as any[]) {
      if (!itemsByStandar.has(r.standar_id)) itemsByStandar.set(r.standar_id, []);
      const st = statusMap.get(r.id) || { status: "belum", catatan: null };
      itemsByStandar.get(r.standar_id)!.push({
        id: r.id,
        kode: r.kode,
        nama: r.nama,
        status: st.status,
        catatan: st.catatan,
      });
    }

    const standar = (standarRes.rows as any[]).map((s) => {
      const items = itemsByStandar.get(s.id) || [];
      const total = items.length;
      const lengkap = items.filter((i) => i.status === "lengkap").length;
      const proses = items.filter((i) => i.status === "proses").length;
      const persen = total > 0 ? Math.round((lengkap / total) * 100) : 0;
      return {
        id: s.id,
        kode: s.kode,
        nama: s.nama,
        urutan: s.urutan,
        total,
        lengkap,
        proses,
        persen,
        items,
      };
    });

    const totalItems = standar.reduce((a, s) => a + s.total, 0);
    const totalLengkap = standar.reduce((a, s) => a + s.lengkap, 0);
    const totalProses = standar.reduce((a, s) => a + s.proses, 0);

    return NextResponse.json({
      featureEnabled: true,
      ts: new Date().toISOString(),
      summary: {
        totalStandar: standar.length,
        totalItems,
        totalLengkap,
        totalProses,
        progres: totalItems > 0 ? Math.round((totalLengkap / totalItems) * 100) : 0,
      },
      standar,
    });
  } catch (error: any) {
    console.error("Akreditasi GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { institutionId } = await context.params;
    const instId = parseInt(institutionId, 10);
    if (isNaN(instId)) {
      return NextResponse.json({ error: "Invalid institution ID" }, { status: 400 });
    }
    const roles = await getLeaderRoles(session.id, instId);
    if (roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "akreditasi");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Modul Akreditasi belum aktif" }, { status: 403 });
    }

    const body = await req.json();
    const itemId = String(body.item_id || "");
    if (!itemId || !/^[0-9a-f-]{36}$/i.test(itemId)) {
      return NextResponse.json({ error: "item_id tidak valid" }, { status: 400 });
    }
    const status = String(body.status || "");
    if (!["belum", "proses", "lengkap"].includes(status)) {
      return NextResponse.json({ error: "status tidak valid" }, { status: 400 });
    }
    const catatan = String(body.catatan || "").trim() || null;

    // Validasi item terhubung ke institusi (lewat standar)
    const itemRes = await query(
      `SELECT ai.id FROM akreditasi_item ai
       JOIN akreditasi_standar a ON a.id = ai.standar_id
       WHERE ai.id = $1 AND ai.is_active = TRUE`,
      [itemId]
    );
    if (itemRes.rows.length === 0) {
      return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
    }

    const res = await query(
      `INSERT INTO akreditasi_status (institution_id, item_id, status, catatan, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (institution_id, item_id)
       DO UPDATE SET status = EXCLUDED.status, catatan = EXCLUDED.catatan,
                     updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING item_id, status, catatan, updated_at`,
      [instId, itemId, status, catatan, session.id]
    );

    return NextResponse.json({ success: true, status: res.rows[0] });
  } catch (error: any) {
    console.error("Akreditasi PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
