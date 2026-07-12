/**
 * Light Load and Query Profiling Test
 * Run: npx vitest run tests/load-test.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { query, pool } from "@/lib/db";
import { GET as adminGet } from "@/app/api/administrasi/route";
import { GET as membersGet } from "@/app/api/institution/[institutionId]/members/route";
import { performance } from "perf_hooks";

// Mock next/headers
let mockCookieValue: string | undefined = undefined;
vi.mock("next/headers", () => {
  return {
    cookies: async () => {
      return {
        get: (name: string) => {
          if (name === "gurupro_session") {
            return mockCookieValue ? { value: decodeURIComponent(mockCookieValue) } : undefined;
          }
          return undefined;
        },
      };
    },
  };
});

function createSessionHeaders(userId: string, activeContext: any = "individual") {
  const session = { id: userId, role: "guru", activeContext };
  const encoded = encodeURIComponent(JSON.stringify(session));
  return {
    "cookie": `gurupro_session=${encoded}`,
    "content-type": "application/json",
    "x-user-id": userId,
  };
}

// Inisialisasi tabel SKP jika belum ada
async function ensureSkpTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS skp_tahunan (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      guru_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tahun_ajaran_id UUID NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      catatan_guru TEXT,
      catatan_kepsek TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guru_id, tahun_ajaran_id)
    )
  `);
  
  await query(`CREATE INDEX IF NOT EXISTS idx_skp_guru_tahun ON skp_tahunan(guru_id, tahun_ajaran_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS indikator_kinerja_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nama VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS skp_indikator (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      skp_id UUID NOT NULL REFERENCES skp_tahunan(id) ON DELETE CASCADE,
      indikator_id UUID NOT NULL REFERENCES indikator_kinerja_config(id),
      target_self DECIMAL(5,2) DEFAULT 0,
      target_sk DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(skp_id, indikator_id)
    )
  `);

  await query(`ALTER TABLE skp_tahunan ADD COLUMN IF NOT EXISTS sekolah_id UUID REFERENCES schools(id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_skp_tahunan_sekolah ON skp_tahunan(sekolah_id)`);
}

async function dbCleanup() {
  await query("DELETE FROM institution_members_role WHERE parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
  await query("DELETE FROM institution_members_assigned_mapel WHERE _parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
  await query("DELETE FROM institution_members_assigned_kelas WHERE _parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
  await query("DELETE FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com') OR user_id IN (SELECT id FROM cms_users WHERE email = 'test-load-guru@example.com')");
  await query("DELETE FROM cms_users WHERE email = 'test-load-guru@example.com'");
  await query("DELETE FROM guru_administrasi WHERE user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com')");
  await query("DELETE FROM institutions WHERE npsn = 'REG-LOAD'");
  await query("DELETE FROM users WHERE email = 'test-load-guru@example.com'");
}

describe("Light Load & Query Profiling Test (N+1 Audit)", () => {
  let userId: string;
  let instId: number;
  let memberId: number;

  beforeAll(async () => {
    await ensureSkpTablesExist();
    await dbCleanup();

    // Setup test data
    const userRes = await query(
      `INSERT INTO users (email, whatsapp, nama_lengkap)
       VALUES ($1, $2, $3) RETURNING id`,
      ["test-load-guru@example.com", "08999999111", "Guru Load Test"]
    );
    userId = userRes.rows[0].id;

    const instRes = await query(
      `INSERT INTO institutions (name, npsn, jenjang, naungan, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ["Test Load Inst", "REG-LOAD", "SMP", "Kemendikbud", "active"]
    );
    instId = instRes.rows[0].id;

    const cmsUserRes = await query(
      `INSERT INTO cms_users (name, email, password)
       VALUES ('Guru Load', 'test-load-guru@example.com', 'pwd') RETURNING id`
    );
    const cmsUserId = cmsUserRes.rows[0].id;

    // Tambah membership aktif dengan mapel/kelas
    const memberRes = await query(
      `INSERT INTO institution_members (user_id, app_user_id, institution_id, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [cmsUserId, userId, instId]
    );
    memberId = memberRes.rows[0].id;

    await query(`INSERT INTO institution_members_role (parent_id, "order", value) VALUES ($1, 0, 'operator')`, [memberId]);
    await query(`INSERT INTO institution_members_assigned_mapel (_order, _parent_id, id, mapel) VALUES (0, $1, gen_random_uuid()::text, 'Matematika')`, [memberId]);
    await query(`INSERT INTO institution_members_assigned_kelas (_order, _parent_id, id, kelas) VALUES (0, $1, gen_random_uuid()::text, 'VIII-A')`, [memberId]);

    // Masukkan beberapa dokumen administrasi
    for (let i = 0; i < 10; i++) {
      await query(
        `INSERT INTO guru_administrasi (id, user_id, tipe_dokumen, judul_dokumen, konten, kurikulum, jenjang)
         VALUES (gen_random_uuid(), $1, 'RPP', $2, '{}', 'Kurikulum Merdeka', 'SMP')`,
        [userId, `RPP Load Test ${i}`]
      );
    }
  });

  afterAll(async () => {
    await dbCleanup();
  });

  it("Profil Eksekusi Query & Latensi (Bebas N+1)", async () => {
    let queryCount = 0;

    // Intersepsi pool.query untuk menghitung jumlah kueri database yang dijalankan
    const originalQuery = pool.query;
    pool.query = function (this: any, ...args: any[]) {
      queryCount++;
      return (originalQuery as any).apply(this, args);
    } as any;

    const iterations = 50;

    // -----------------------------------------------------------------------
    // 1. PROFILE: Dashboard Guru (Individual Context)
    // -----------------------------------------------------------------------
    queryCount = 0;
    const startInd = performance.now();
    const indHeaders = createSessionHeaders(userId, "individual");

    for (let i = 0; i < iterations; i++) {
      mockCookieValue = indHeaders.cookie.split("=")[1];
      const req = new Request("http://localhost/api/administrasi", {
        method: "GET",
        headers: { "cookie": indHeaders.cookie },
      });
      await adminGet(req);
    }
    const endInd = performance.now();
    const avgTimeInd = (endInd - startInd) / iterations;
    const queriesPerCallInd = queryCount / iterations;

    console.log(`[LATENCY] Dashboard Guru (Konteks Individual): ${avgTimeInd.toFixed(2)}ms per call`);
    console.log(`[QUERIES] Dashboard Guru (Konteks Individual): ${queriesPerCallInd} queries per call`);

    expect(queriesPerCallInd).toBeLessThanOrEqual(4); // Harus O(1) kueri, bukan N+1

    // -----------------------------------------------------------------------
    // 2. PROFILE: Dashboard Guru (Institution Context Switch)
    // -----------------------------------------------------------------------
    queryCount = 0;
    const startInst = performance.now();
    const instHeaders = createSessionHeaders(userId, { institutionId: instId });

    for (let i = 0; i < iterations; i++) {
      mockCookieValue = instHeaders.cookie.split("=")[1];
      const req = new Request("http://localhost/api/administrasi", {
        method: "GET",
        headers: { "cookie": instHeaders.cookie },
      });
      await adminGet(req);
    }
    const endInst = performance.now();
    const avgTimeInst = (endInst - startInst) / iterations;
    const queriesPerCallInst = queryCount / iterations;

    console.log(`[LATENCY] Dashboard Guru (Konteks Institusi): ${avgTimeInst.toFixed(2)}ms per call`);
    console.log(`[QUERIES] Dashboard Guru (Konteks Institusi): ${queriesPerCallInst} queries per call`);

    expect(queriesPerCallInst).toBeLessThanOrEqual(4); // Harus O(1) kueri

    // -----------------------------------------------------------------------
    // 3. PROFILE: Operator Member List
    // -----------------------------------------------------------------------
    queryCount = 0;
    const startMem = performance.now();

    for (let i = 0; i < iterations; i++) {
      const req = new Request(`http://localhost/api/institution/${instId}/members`, {
        method: "GET",
        headers: { "cookie": instHeaders.cookie },
      });
      await membersGet(req, { params: Promise.resolve({ institutionId: String(instId) }) });
    }
    const endMem = performance.now();
    const avgTimeMem = (endMem - startMem) / iterations;
    const queriesPerCallMem = queryCount / iterations;

    console.log(`[LATENCY] Daftar Anggota Operator: ${avgTimeMem.toFixed(2)}ms per call`);
    console.log(`[QUERIES] Daftar Anggota Operator: ${queriesPerCallMem} queries per call`);

    expect(queriesPerCallMem).toBeLessThanOrEqual(3); // Harus O(1) kueri

    // Kembalikan kueri asli
    pool.query = originalQuery;
  });
});
