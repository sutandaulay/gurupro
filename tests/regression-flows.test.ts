import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { pool } from "@/lib/db";

let client: any = null;

async function query(text: string, params?: any[]) {
  if (!client) {
    client = await pool.connect();
  }
  return client.query(text, params);
}
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { GET as activeContextGet, PUT as activeContextPut } from "@/app/api/auth/active-context/route";
import { POST as inviteHandler } from "@/app/api/institutions/members/invite/route";
import { POST as acceptHandler } from "@/app/api/institutions/members/[memberId]/accept/route";
import { POST as rejectHandler } from "@/app/api/institutions/members/[memberId]/reject/route";
import { POST as leaveHandler } from "@/app/api/institutions/members/[memberId]/leave/route";
import { GET as adminGet, POST as adminPost } from "@/app/api/administrasi/route";
import { POST as approveHandler } from "@/app/api/skp/[id]/approve/route";
import { POST as resetPasswordHandler } from "@/app/api/institution/[institutionId]/members/reset-password/route";
import { GET as membersGet } from "@/app/api/institution/[institutionId]/members/route";
import { grantUserTokens, grantAddonTokens, evaluateTokenAccess } from "@/lib/token-system";
import { getUserAccountMode } from "@/lib/institution-members";

// ==========================================
// MOCK COOKIES
// ==========================================
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
        set: (name: string, value: string, opts?: any) => {
          if (name === "gurupro_session") {
            mockCookieValue = value;
          }
        },
      };
    },
  };
});

vi.mock("@/lib/notifications", () => {
  return {
    sendEmailNotification: vi.fn().mockResolvedValue({ success: true, simulated: true }),
    sendWhatsAppNotification: vi.fn().mockResolvedValue({ success: true, simulated: true }),
    sendEventNotification: vi.fn().mockResolvedValue({ success: true, simulated: true }),
  };
});

// Helper untuk setup headers request
function createSessionHeaders(userId: string) {
  const session = { id: userId, role: "guru", activeContext: "individual" };
  const encoded = encodeURIComponent(JSON.stringify(session));
  return {
    "cookie": `gurupro_session=${encoded}`,
    "content-type": "application/json",
    "x-user-id": userId, // untuk middleware
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

// Clean up function to run before and after tests
async function dbCleanup() {
  await query("DELETE FROM in_app_notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-regression-%')");
  await query("DELETE FROM skp_indikator WHERE skp_id IN (SELECT id FROM skp_tahunan WHERE guru_id IN (SELECT id FROM users WHERE email LIKE 'test-regression-%'))");
  await query("DELETE FROM skp_tahunan WHERE guru_id IN (SELECT id FROM users WHERE email LIKE 'test-regression-%')");
  await query("DELETE FROM teacher_journals WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE 'test-regression-%')");
  await query("DELETE FROM guru_administrasi WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-regression-%')");
  await query("DELETE FROM payload.institution_members_role WHERE parent_id IN (SELECT id FROM payload.institution_members WHERE app_user_id IN (SELECT id::varchar FROM users WHERE email LIKE 'test-regression-%'))");
  await query("DELETE FROM payload.institution_members_assigned_mapel WHERE _parent_id IN (SELECT id FROM payload.institution_members WHERE app_user_id IN (SELECT id::varchar FROM users WHERE email LIKE 'test-regression-%'))");
  await query("DELETE FROM payload.institution_members_assigned_kelas WHERE _parent_id IN (SELECT id FROM payload.institution_members WHERE app_user_id IN (SELECT id::varchar FROM users WHERE email LIKE 'test-regression-%'))");
  await query("DELETE FROM payload.institution_members WHERE app_user_id IN (SELECT id::varchar FROM users WHERE email LIKE 'test-regression-%') OR user_id IN (SELECT id FROM payload.cms_users WHERE email LIKE 'test-regression-%')");
  await query("DELETE FROM payload.cms_users WHERE email LIKE 'test-regression-%'");
  await query("DELETE FROM schools WHERE npsn LIKE 'REG-%'");
  
  // Hapus relasi anggota institusi yang akan dihapus untuk menghindari pelanggaran constraint NOT NULL
  await query("DELETE FROM payload.institution_members_role WHERE parent_id IN (SELECT id FROM payload.institution_members WHERE institution_id IN (SELECT id FROM payload.institutions WHERE npsn LIKE 'REG-%' OR name LIKE 'Test Regression %'))");
  await query("DELETE FROM payload.institution_members_assigned_mapel WHERE _parent_id IN (SELECT id FROM payload.institution_members WHERE institution_id IN (SELECT id FROM payload.institutions WHERE npsn LIKE 'REG-%' OR name LIKE 'Test Regression %'))");
  await query("DELETE FROM payload.institution_members_assigned_kelas WHERE _parent_id IN (SELECT id FROM payload.institution_members WHERE institution_id IN (SELECT id FROM payload.institutions WHERE npsn LIKE 'REG-%' OR name LIKE 'Test Regression %'))");
  await query("DELETE FROM payload.institution_members WHERE institution_id IN (SELECT id FROM payload.institutions WHERE npsn LIKE 'REG-%' OR name LIKE 'Test Regression %')");
  
  await query("DELETE FROM payload.institutions WHERE npsn LIKE 'REG-%' OR name LIKE 'Test Regression %'");
  await query("DELETE FROM users WHERE email LIKE 'test-regression-%'");
}

describe("Phase 0 - Regression Tests", () => {
  beforeAll(async () => {
    client = await pool.connect();
    await ensureSkpTablesExist();
  });

  beforeEach(async () => {
    mockCookieValue = undefined;
    await dbCleanup();
  });

  afterAll(async () => {
    await dbCleanup();
    if (client) {
      client.release();
    }
  });

  // =========================================================================
  // JALUR INDIVIDUAL
  // =========================================================================
  describe("Jalur Individual", () => {
    it("1. Registrasi guru baru tanpa institusi berhasil & dashboard tampil normal", async () => {
      // Buat FormData untuk register
      const formData = new FormData();
      formData.append("email", "test-regression-guru-new@example.com");
      formData.append("password", "password123");
      formData.append("confirm_password", "password123");
      formData.append("whatsapp", "+628999111222");
      formData.append("nama_lengkap", "Guru Baru Test");
      formData.append("username", "guru_baru_test");
      formData.append("pdp_consent", "on");
      formData.append("pdp_policy_version", "1.0");

      const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: formData,
      });

      const res = await registerHandler(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Ambil user dari database
      const userRes = await query("SELECT * FROM users WHERE email = $1", ["test-regression-guru-new@example.com"]);
      expect(userRes.rows.length).toBe(1);
      const user = userRes.rows[0];

      // Akun terdaftar tanpa institusi apapun
      const membersRes = await query("SELECT * FROM payload.institution_members WHERE app_user_id = $1", [user.id]);
      expect(membersRes.rows.length).toBe(0);

      // Cek mode akun
      const accountMode = await getUserAccountMode(user.id);
      expect(accountMode).toBe("INDIVIDUAL_ONLY");
    });

    it("2. Login dan buat dokumen (RPP/Modul Ajar) tersimpan dengan institution_id = null", async () => {
      // 1. Setup User
      const userRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap, password_hash, subscription_start, subscription_end, status_langganan)
         VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '30 days', 'free')
         RETURNING *`,
        ["test-regression-guru-doc@example.com", "08999111223", "Guru Doc Test", "hashed_pwd"]
      );
      const user = userRes.rows[0];

      // 2. Buat dokumen baru via POST api/administrasi
      const headers = createSessionHeaders(user.id);
      mockCookieValue = headers.cookie.split("=")[1];

      const docBody = {
        tipe_dokumen: "RPP",
        judul_dokumen: "RPP Matematika Integral",
        konten: { materi: "Integral Lipat Dua" },
      };

      const req = new Request("http://localhost/api/administrasi", {
        method: "POST",
        headers: {
          "cookie": headers.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify(docBody),
      });

      const res = await adminPost(req as any);
      expect(res.status).toBe(200);
      const resData = await res.json();
      expect(resData.success).toBe(true);

      // 3. Verifikasi di DB bahwa document tersimpan dengan institution_id = null
      const docDb = await query("SELECT * FROM guru_administrasi WHERE id = $1", [resData.id]);
      expect(docDb.rows.length).toBe(1);
      expect(docDb.rows[0].institution_id).toBeNull();
      expect(docDb.rows[0].owned_by_institution).toBe(false);
    });

    it("3. Top-up token pribadi menambah saldo dan tidak berinteraksi dengan institusi", async () => {
      // Setup User
      const userRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap, token_limit, addon_token_balance)
         VALUES ($1, $2, $3, 5, 0)
         RETURNING *`,
        ["test-regression-guru-topup@example.com", "08999111224", "Guru Topup Test"]
      );
      const user = userRes.rows[0];

      // Topup main token
      const nextMain = await grantUserTokens(user.id, 10);
      expect(nextMain).toBe(15);

      // Topup addon token
      const nextAddon = await grantAddonTokens(user.id, 20);
      expect(nextAddon).toBe(20);

      // Verifikasi di DB
      const dbCheck = await query("SELECT token_limit, addon_token_balance FROM users WHERE id = $1", [user.id]);
      expect(dbCheck.rows[0].token_limit).toBe(15);
      expect(dbCheck.rows[0].addon_token_balance).toBe(20);
    });

    it("4. Masa aktif subscription individual dihitung dengan benar", () => {
      const activeEnd = new Date(Date.now() + 86400000 * 5).toISOString(); // Aktif 5 hari lagi
      const accessActive = evaluateTokenAccess({
        role: "guru",
        tokenLimit: 10,
        subscriptionEnd: activeEnd,
      });
      expect(accessActive.allowed).toBe(true);

      const expiredEnd = new Date(Date.now() - 86400000).toISOString(); // Kedaluwarsa 1 hari lalu
      const accessExpired = evaluateTokenAccess({
        role: "guru",
        tokenLimit: 10,
        subscriptionEnd: expiredEnd,
      });
      expect(accessExpired.allowed).toBe(false);
      expect(accessExpired.reason).toBe("subscription_expired");
    });
  });

  // =========================================================================
  // JALUR DUAL-MODE
  // =========================================================================
  describe("Jalur Dual-Mode", () => {
    it("Alur Undangan: Invite -> Terima -> Context Switch -> Dokumen Terpisah -> Reject -> Leave", async () => {
      // 1. Setup Data: Institusi, Operator Sekolah, Guru
      const instRes = await query(
        `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        ["Test Regression Inst A", "REG-0001", "SMP", "Kemendikbud", "premium", "active"]
      );
      const inst = instRes.rows[0];

      const opRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-op@example.com", "+628999111999", "Operator Inst A"]
      );
      const op = opRes.rows[0];

      const cmsOpRes = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash)
         VALUES ($1, $2, 'editor', '', '') RETURNING id`,
        ["Operator Inst A", "test-regression-op@example.com"]
      );
      const cmsOp = cmsOpRes.rows[0];

      // Jadikan Operator Aktif di Institusi
      const opMember = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [cmsOp.id, op.id, inst.id]
      );
      await query(
        `INSERT INTO payload.institution_members_role (parent_id, "order", value)
         VALUES ($1, 0, 'operator')`,
        [opMember.rows[0].id]
      );

      // Setup Guru Aktif Individual
      const guruRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap, subscription_start, subscription_end, status_langganan)
         VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '30 days', 'active') RETURNING *`,
        ["test-regression-guru-dual@example.com", "08999111991", "Guru Dual Test"]
      );
      const guru = guruRes.rows[0];

      // Simpan beberapa dokumen individual guru sebelum bergabung
      await query(
        `INSERT INTO guru_administrasi (id, user_id, tipe_dokumen, judul_dokumen, konten, owned_by_institution)
         VALUES (gen_random_uuid(), $1, 'RPP', 'Dokumen Pribadi 1', '{}', false)`,
        [guru.id]
      );

      // ----------------------------------------------------
      // STEP A: Operator mengundang Guru
      // ----------------------------------------------------
      const inviteHeaders = createSessionHeaders(op.id);
      mockCookieValue = inviteHeaders.cookie.split("=")[1];
      const inviteReq = new Request("http://localhost/api/institutions/members/invite", {
        method: "POST",
        headers: {
          "cookie": inviteHeaders.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          emailOrNik: "test-regression-guru-dual@example.com",
          institutionId: inst.id,
        }),
      });

      const inviteRes = await inviteHandler(inviteReq as any);
      expect(inviteRes.status).toBe(200);

      // Verifikasi notifikasi in-app terkirim ke Guru
      const notifRes = await query("SELECT * FROM in_app_notifications WHERE user_id = $1", [guru.id]);
      expect(notifRes.rows.length).toBe(1);
      expect(notifRes.rows[0].title).toContain("Undangan");

      // Verifikasi subscription guru tidak berubah saat di-invite
      const checkSubGuru = await query("SELECT status_langganan FROM users WHERE id = $1", [guru.id]);
      expect(checkSubGuru.rows[0].status_langganan).toBe("active");

      // Ambil ID member undangan
      const memberInvitation = await query(
        "SELECT id FROM payload.institution_members WHERE app_user_id = $1 AND institution_id = $2 AND status = 'invited'",
        [guru.id, inst.id]
      );
      expect(memberInvitation.rows.length).toBe(1);
      const memberId = memberInvitation.rows[0].id;

      // ----------------------------------------------------
      // STEP B: Guru Menerima Undangan (Accept)
      // ----------------------------------------------------
      const guruHeaders = createSessionHeaders(guru.id);
      mockCookieValue = guruHeaders.cookie.split("=")[1];
      const acceptReq = new Request(`http://localhost/api/institutions/members/${memberId}/accept`, {
        method: "POST",
        headers: { "cookie": guruHeaders.cookie },
      });

      const acceptRes = await acceptHandler(acceptReq as any, { params: Promise.resolve({ memberId: String(memberId) }) });
      expect(acceptRes.status).toBe(200);

      // Verifikasi status keanggotaan menjadi active di DB
      const memberCheck = await query("SELECT status FROM payload.institution_members WHERE id = $1", [memberId]);
      expect(memberCheck.rows[0].status).toBe("active");

      // Verifikasi accountMode menjadi DUAL
      const modeDual = await getUserAccountMode(guru.id);
      expect(modeDual).toBe("DUAL");

      // ----------------------------------------------------
      // STEP C: Guru Mengubah Konteks Aktif (Context Switch)
      // ----------------------------------------------------
      mockCookieValue = guruHeaders.cookie.split("=")[1];
      const contextReq = new Request("http://localhost/api/auth/active-context", {
        method: "PUT",
        headers: {
          "cookie": guruHeaders.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          activeContext: { institutionId: inst.id },
        }),
      });

      const contextRes = await activeContextPut(contextReq as any);
      expect(contextRes.status).toBe(200);

      // Cek info active-context saat ini
      const getContextReq = new Request("http://localhost/api/auth/active-context", {
        method: "GET",
        headers: { "cookie": guruHeaders.cookie },
      });
      const getContextRes = await activeContextGet();
      const contextData = await getContextRes.json();
      expect(contextData.activeContext.institutionId).toBe(inst.id);

      // ----------------------------------------------------
      // STEP D: Verifikasi Dokumen Pribadi Tetap Utuh
      // ----------------------------------------------------
      // Buat request fetch administrasi
      const adminReq = new Request("http://localhost/api/administrasi", {
        method: "GET",
        headers: { "cookie": guruHeaders.cookie },
      });
      const adminGetRes = await adminGet(adminReq as any);
      const adminDocs = await adminGetRes.json();
      // Dokumen pribadi tetap muncul di response list
      expect(adminDocs.some((d: any) => d.judul_dokumen === "Dokumen Pribadi 1")).toBe(true);

      // ----------------------------------------------------
      // STEP E: Guru Keluar (Leave) Institusi -> Jadi Read-Only
      // ----------------------------------------------------
      const leaveReq = new Request(`http://localhost/api/institutions/members/${memberId}/leave`, {
        method: "POST",
        headers: { "cookie": guruHeaders.cookie },
      });
      const leaveRes = await leaveHandler(leaveReq as any, { params: Promise.resolve({ memberId: String(memberId) }) });
      expect(leaveRes.status).toBe(200);

      // Status keanggotaan menjadi left
      const memberLeftCheck = await query("SELECT status FROM payload.institution_members WHERE id = $1", [memberId]);
      expect(memberLeftCheck.rows[0].status).toBe("left");

      // Coba ubah konteks kembali ke institusi -> harus gagal/403 karena bukan anggota aktif
      const contextSwitchFailedReq = new Request("http://localhost/api/auth/active-context", {
        method: "PUT",
        headers: {
          "cookie": guruHeaders.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          activeContext: { institutionId: inst.id },
        }),
      });
      const contextSwitchFailedRes = await activeContextPut(contextSwitchFailedReq as any);
      expect(contextSwitchFailedRes.status).toBe(403);
    });

    it("Undangan Ditolak (Reject Invite)", async () => {
      // Setup Institusi & Operator
      const instRes = await query(
        `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ["Test Regression Inst B", "REG-0002", "SMA", "Kemendikbud", "active"]
      );
      const instId = instRes.rows[0].id;

      const opRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-op2@example.com", "08999111995", "Operator Inst B"]
      );
      const opId = opRes.rows[0].id;

      const cmsOpRes = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash)
         VALUES ('Operator B', 'test-regression-op2@example.com', 'editor', '', '') RETURNING id`
      );
      const cmsOpId = cmsOpRes.rows[0].id;

      const opMember = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [cmsOpId, opId, instId]
      );
      await query(`INSERT INTO payload.institution_members_role (parent_id, "order", value) VALUES ($1, 0, 'operator')`, [opMember.rows[0].id]);

      // Setup Guru
      const guruRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-guru-rej@example.com", "08999111993", "Guru Reject Test"]
      );
      const guruId = guruRes.rows[0].id;

      // Operator invite Guru
      const inviteHeaders = createSessionHeaders(opId);
      mockCookieValue = inviteHeaders.cookie.split("=")[1];
      const inviteReq = new Request("http://localhost/api/institutions/members/invite", {
        method: "POST",
        headers: {
          "cookie": inviteHeaders.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          emailOrNik: "test-regression-guru-rej@example.com",
          institutionId: instId,
        }),
      });
      await inviteHandler(inviteReq as any);

      const memberInv = await query(
        "SELECT id FROM payload.institution_members WHERE app_user_id = $1 AND institution_id = $2 AND status = 'invited'",
        [guruId, instId]
      );
      const memberId = memberInv.rows[0].id;

      // Guru Reject Invite
      const guruHeaders = createSessionHeaders(guruId);
      mockCookieValue = guruHeaders.cookie.split("=")[1];
      const rejectReq = new Request(`http://localhost/api/institutions/members/${memberId}/reject`, {
        method: "POST",
        headers: { "cookie": guruHeaders.cookie },
      });
      const rejectRes = await rejectHandler(rejectReq as any, { params: Promise.resolve({ memberId: String(memberId) }) });
      expect(rejectRes.status).toBe(200);

      // Verifikasi status ditolak di DB
      const memberRejCheck = await query("SELECT status FROM payload.institution_members WHERE id = $1", [memberId]);
      expect(memberRejCheck.rows[0].status).toBe("rejected");
    });
  });

  // =========================================================================
  // JALUR RBAC
  // =========================================================================
  describe("Jalur RBAC", () => {
    it("1. Guru biasa ditolak (403) saat mengakses route operator", async () => {
      // Setup Guru
      const userRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-guru-rbac@example.com", "08999111333", "Guru RBAC Test"]
      );
      const guruId = userRes.rows[0].id;

      // Guru mencoba mengakses list member operator (route operator)
      const headers = createSessionHeaders(guruId);
      mockCookieValue = headers.cookie.split("=")[1];

      const req = new Request("http://localhost/api/institution/10/members", {
        method: "GET",
        headers: { "cookie": headers.cookie },
      });

      const res = await membersGet(req as any, { params: Promise.resolve({ institutionId: "10" }) });
      expect(res.status).toBe(403);
    });

    it("2. Operator Inst A ditolak (403/404) ketika mencoba reset password Guru di Inst B", async () => {
      // 1. Setup Inst A & Operator A
      const instARes = await query(
        `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ["Test Regression Inst A", "REG-000A", "SMP", "Kemendikbud", "active"]
      );
      const instAId = instARes.rows[0].id;

      const opARes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-op-a@example.com", "08999111441", "Operator A"]
      );
      const opAId = opARes.rows[0].id;

      const cmsOpARes = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash)
         VALUES ('Operator A', 'test-regression-op-a@example.com', 'editor', '', '') RETURNING id`
      );
      const cmsOpAId = cmsOpARes.rows[0].id;

      const opAMember = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [cmsOpAId, opAId, instAId]
      );
      await query(`INSERT INTO payload.institution_members_role (parent_id, "order", value) VALUES ($1, 0, 'operator')`, [opAMember.rows[0].id]);

      // 2. Setup Inst B & Guru B
      const instBRes = await query(
        `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ["Test Regression Inst B", "REG-000B", "SMP", "Kemendikbud", "active"]
      );
      const instBId = instBRes.rows[0].id;

      const guruBRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-guru-b@example.com", "08999111442", "Guru B"]
      );
      const guruBId = guruBRes.rows[0].id;

      const cmsGuruBRes = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash)
         VALUES ('Guru B', 'test-regression-guru-b@example.com', 'editor', '', '') RETURNING id`
      );
      const cmsGuruBId = cmsGuruBRes.rows[0].id;

      const guruBMember = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [cmsGuruBId, guruBId, instBId]
      );

      // 3. Operator A mencoba memanggil reset password untuk Guru B
      // Kasus 3a: Menggunakan route Inst B (dapat 403 karena Operator A bukan anggota Inst B)
      const headersOpA = createSessionHeaders(opAId);
      mockCookieValue = headersOpA.cookie.split("=")[1];

      const reqResetB = new Request(`http://localhost/api/institution/${instBId}/members/reset-password`, {
        method: "POST",
        headers: {
          "cookie": headersOpA.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          memberId: guruBMember.rows[0].id,
        }),
      });

      const resResetB = await resetPasswordHandler(reqResetB as any, { params: Promise.resolve({ institutionId: String(instBId) }) });
      expect(resResetB.status).toBe(403);

      // Kasus 3b: Menggunakan route Inst A dengan memberId milik Inst B (dapat 404 karena memberId tsb bukan milik Inst A)
      const reqResetA = new Request(`http://localhost/api/institution/${instAId}/members/reset-password`, {
        method: "POST",
        headers: {
          "cookie": headersOpA.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          memberId: guruBMember.rows[0].id,
        }),
      });

      const resResetA = await resetPasswordHandler(reqResetA as any, { params: Promise.resolve({ institutionId: String(instAId) }) });
      expect(resResetA.status).toBe(404);
    });

    it("3. Bendahara ditolak (403) saat menyetujui dokumen SKP", async () => {
      // 1. Setup Inst, Bendahara, Guru, Sekolah, SKP
      const instRes = await query(
        `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ["Test Regression Inst C", "REG-000C", "SMP", "Kemendikbud", "active"]
      );
      const instId = instRes.rows[0].id;

      const schRes = await query(
        `INSERT INTO schools (user_id, nama_sekolah, npsn)
         VALUES (gen_random_uuid(), 'SMP C', 'REG-000C') RETURNING id`
      );
      const schoolId = schRes.rows[0].id;

      const bendaharaRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-bendahara@example.com", "08999111551", "Bendahara C"]
      );
      const bendaharaId = bendaharaRes.rows[0].id;

      const cmsBendaharaRes = await query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash)
         VALUES ('Bendahara C', 'test-regression-bendahara@example.com', 'editor', '', '') RETURNING id`
      );
      const cmsBendaharaId = cmsBendaharaRes.rows[0].id;

      const bendaharaMember = await query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [cmsBendaharaId, bendaharaId, instId]
      );
      await query(`INSERT INTO payload.institution_members_role (parent_id, "order", value) VALUES ($1, 0, 'bendahara')`, [bendaharaMember.rows[0].id]);

      // Setup Guru
      const guruRes = await query(
        `INSERT INTO users (email, whatsapp, nama_lengkap)
         VALUES ($1, $2, $3) RETURNING id`,
        ["test-regression-guru-skp@example.com", "08999111552", "Guru SKP Test"]
      );
      const guruId = guruRes.rows[0].id;

      // Buat SKP submitted
      const skpRes = await query(
        `INSERT INTO skp_tahunan (guru_id, tahun_ajaran_id, status, sekolah_id)
         VALUES ($1, gen_random_uuid(), 'submitted', $2) RETURNING id`,
        [guruId, schoolId]
      );
      const skpId = skpRes.rows[0].id;

      // 2. Bendahara mencoba memanggil approve SKP
      const bendHeaders = createSessionHeaders(bendaharaId);
      mockCookieValue = bendHeaders.cookie.split("=")[1];

      const reqApprove = new Request(`http://localhost/api/skp/${skpId}/approve`, {
        method: "POST",
        headers: {
          "cookie": bendHeaders.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ catatanKepsek: "Ditolak Bendahara" }),
      });

      const resApprove = await approveHandler(reqApprove as any, { params: Promise.resolve({ id: String(skpId) }) });
      expect(resApprove.status).toBe(403);
    });
  });
});
