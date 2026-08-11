import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { enforceOutputLimits } from "@/lib/ai/limits";

// =====================================================
// AI Ringkasan Laporan — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only. Generate ringkasan eksekutif
// naratif berbasis data agregasi institusi (SSE streaming).
// Gate: feature flag command_center + RBAC leader.
// =====================================================

const LEADER_ROLES = ["kepala_sekolah", "wakasek"];

const genAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null;

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

async function collectRingkasanData(instId: number) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayOfWeek = now.getDay();
  const backToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - backToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    instRes,
    guruRes,
    attendanceRes,
    siswaAggRes,
    siswaTodayRes,
    raportRes,
    adokRes,
    stafRes,
    telatRes,
    unassignedRes,
  ] = await Promise.all([
    query(`SELECT name, jenjang, academic_year_active FROM institutions WHERE id = $1`, [instId]),
    query(
      `SELECT DISTINCT im.app_user_id AS guru_id, u.nama_lengkap AS nama
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
      [instId]
    ),
    query(
      `SELECT teacher_id, attendance_status
       FROM attendance_summary
       WHERE institution_id = $1 AND date >= $2 AND date < $3`,
      [instId, startOfToday.toISOString(), tomorrow.toISOString()]
    ),
    query(
      `SELECT COUNT(DISTINCT st.id)::int AS total_siswa
       FROM students st
       JOIN classes c ON c.id = st.class_id
       JOIN institutions i ON i.school_id = c.school_id
       WHERE i.id = $1`,
      [instId]
    ),
    query(
      `SELECT sa.status, COUNT(DISTINCT sa.student_id)::int AS jumlah
       FROM student_attendance sa
       JOIN schedules sc ON sc.id = sa.schedule_id
       JOIN classes c ON c.id = sc.class_id
       JOIN institutions i ON i.school_id = c.school_id
       WHERE i.id = $1 AND sa.tanggal = CURRENT_DATE
       GROUP BY sa.status`,
      [instId]
    ),
    query(
      `SELECT dr.status, COUNT(*)::int AS jumlah
       FROM data_raport dr
       JOIN classes c ON c.id = dr.kelas_id
       JOIN institutions i ON i.school_id = c.school_id
       WHERE i.id = $1
       GROUP BY dr.status`,
      [instId]
    ),
    query(
      `SELECT tipe_dokumen, approval_status, COUNT(*)::int AS jumlah
       FROM guru_administrasi
       WHERE institution_id = $1 AND tipe_dokumen IN ('rpp','modul','modul_ajar')
       GROUP BY tipe_dokumen, approval_status`,
      [instId]
    ),
    query(
      `SELECT imr.value AS role, COUNT(DISTINCT im.id)::int AS jumlah
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.institution_id = $1 AND im.status = 'active'
       GROUP BY imr.value`,
      [instId]
    ),
    query(
      `SELECT al.teacher_id, COUNT(*)::int AS jumlah_telat
       FROM attendance_logs al
       WHERE al.institution_id = $1
         AND al.timestamp >= $2 AND al.timestamp <= $3
         AND (al.status = 'flagged' OR al.flag_reasons::text ILIKE '%late%' OR al.flag_reasons::text ILIKE '%telat%')
       GROUP BY al.teacher_id
       HAVING COUNT(*) >= 3`,
      [instId, startOfWeek.toISOString(), endOfWeek.toISOString()]
    ),
    query(
      `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       JOIN users u ON u.id::text = im.app_user_id
       WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
         AND NOT EXISTS (
           SELECT 1 FROM teacher_institution_assignments tia
           WHERE tia.institution_id = im.institution_id
             AND tia.teacher_id::text = im.app_user_id
         )`,
      [instId]
    ),
  ]);

  const inst = instRes.rows[0] || {};
  const guruList = guruRes.rows as any[];
  const namaMap = new Map<string, string>();
  for (const g of guruList) namaMap.set(g.guru_id, g.nama || "Guru");
  const totalGuru = guruList.length;

  const statusCounts: Record<string, number> = {};
  for (const row of attendanceRes.rows as any[]) {
    const status = row.attendance_status || "tanpa_data";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const hadir = statusCounts["hadir"] || 0;
  const telat = statusCounts["telat"] || 0;
  const izin = statusCounts["izin"] || 0;
  const sakit = statusCounts["sakit"] || 0;
  const alpa = statusCounts["alpa"] || 0;
  const belumAbsen = Math.max(
    0,
    totalGuru - hadir - telat - izin - sakit - alpa
  );

  const totalSiswa = Number(siswaAggRes.rows[0]?.total_siswa || 0);
  const siswaStatus: Record<string, number> = {};
  for (const row of siswaTodayRes.rows as any[]) {
    const st = String(row.status || "Lainnya").toLowerCase();
    siswaStatus[st] = (siswaStatus[st] || 0) + Number(row.jumlah || 0);
  }
  const siswaHadir = siswaStatus["hadir"] || 0;

  const raportByStatus: Record<string, number> = {};
  let totalRaport = 0;
  for (const row of raportRes.rows as any[]) {
    raportByStatus[row.status] = Number(row.jumlah || 0);
    totalRaport += Number(row.jumlah || 0);
  }

  const adokByStatus: Record<string, number> = {};
  for (const row of adokRes.rows as any[]) {
    const key = `${row.tipe_dokumen}:${row.approval_status || "draft"}`;
    adokByStatus[key] = Number(row.jumlah || 0);
  }
  const strukturStaf: Record<string, number> = {};
  for (const row of stafRes.rows as any[]) {
    strukturStaf[row.role] = Number(row.jumlah || 0);
  }

  const telatBerulang = (telatRes.rows as any[]).map((r) => ({
    nama: namaMap.get(r.teacher_id) || "Guru",
    jumlahTelat: Number(r.jumlah_telat || 0),
  }));
  const belumTerassign = (unassignedRes.rows as any[]).map((r) => r.nama || "Guru");

  return {
    institusi: inst.name || `Institusi #${instId}`,
    jenjang: inst.jenjang || "-",
    tahunAjaran: inst.academic_year_active || "-",
    tanggal: now.toISOString().split("T")[0],
    kehadiranGuru: { totalGuru, hadir, telat, izin, sakit, alpa, belumAbsen },
    kehadiranSiswa: { totalSiswa, hadir: siswaHadir },
    raport: { total: totalRaport, byStatus: raportByStatus },
    dokumenAdministrasi: adokByStatus,
    strukturStaf,
    insiden: { telatBerulang, belumTerassign },
  };
}

function buildPrompt(data: Awaited<ReturnType<typeof collectRingkasanData>>): string {
  const raportLine = Object.entries(data.raport.byStatus)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") || "- belum ada data";
  const stafLine = Object.entries(data.strukturStaf)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ") || "-";
  const dokLine = Object.entries(data.dokumenAdministrasi)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "-";
  const telatLine =
    data.insiden.telatBerulang.length > 0
      ? data.insiden.telatBerulang
          .map((t) => `${t.nama} (${t.jumlahTelat}x)`)
          .join(", ")
      : "tidak ada";
  const unassignedLine =
    data.insiden.belumTerassign.length > 0
      ? data.insiden.belumTerassign.join(", ")
      : "tidak ada";

  return `
Kamu adalah asisten Kepala Sekolah di platform GuruPRO AI. Buatkan RINGKASAN EKSEKUTIF mingguan berbahasa Indonesia yang profesional, padat, dan berbasis data nyata di bawah.

DATA INSTITUSI PER ${data.tanggal}:
- Nama: ${data.institusi}
- Jenjang: ${data.jenjang}
- Tahun Ajaran Aktif: ${data.tahunAjaran}

KEHADIRAN GURU HARI INI (total ${data.kehadiranGuru.totalGuru}):
- Hadir: ${data.kehadiranGuru.hadir}, Telat: ${data.kehadiranGuru.telat}, Izin: ${data.kehadiranGuru.izin}, Sakit: ${data.kehadiranGuru.sakit}, Alpa: ${data.kehadiranGuru.alpa}, Belum absen: ${data.kehadiranGuru.belumAbsen}

KEHADIRAN SISWA HARI INI (total ${data.kehadiranSiswa.totalSiswa}):
- Hadir: ${data.kehadiranSiswa.hadir}

E-RAPORT (total ${data.raport.total}):
${raportLine}

DOKUMEN ADMINISTRASI (RPP/Modul):
${dokLine}

STRUKTUR STAF:
${stafLine}

INSIDEN / PERHATIAN MINGGU INI:
- Guru telat berulang (>=3x): ${telatLine}
- Guru belum ter-assign kelas/mapel: ${unassignedLine}

TUGAS:
1. Tulis ringkasan eksekutif 200-350 kata yang mudah dipahami Kepala Sekolah.
2. Soroti capaian positif (tingkat kehadiran, progres raport) dan area yang perlu perhatian (insiden, kekurangan).
3. Akhiri dengan 3-5 rekomendasi tindakan yang spesifik dan actionable.
4. Jangan menambahkan data yang tidak ada di atas. Jika suatu angka 0, sampaikan dengan jujur tapi konstruktif.

FORMAT OUTPUT (JSON ketat, tanpa teks di luar JSON):
\`\`\`json
{
  "ringkasan_eksekutif": "narasi 1 paragraf utama...",
  "poin_positif": ["capaian 1", "capaian 2"],
  "area_perhatian": ["area 1", "area 2"],
  "rekomendasi": [
    {"judul": "rekomendasi 1", "detail": "langkah yang bisa diambil"}
  ]
}
\`\`\`
`;
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
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "command_center");
    if (!featureEnabled) {
      return NextResponse.json(
        {
          featureEnabled: false,
          message:
            "Ringkasan AI belum aktif untuk institusi ini. Aktifkan fitur Command Center terlebih dahulu.",
        },
        { status: 200 }
      );
    }
    const data = await collectRingkasanData(instId);
    return NextResponse.json({
      featureEnabled: true,
      aiConfigured: Boolean(genAI),
      preview: data,
    });
  } catch (error: any) {
    console.error("GET /api/institution/[institutionId]/ai-ringkasan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
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
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "command_center");
    if (!featureEnabled) {
      return NextResponse.json(
        { error: "Ringkasan AI belum aktif untuk institusi ini" },
        { status: 403 }
      );
    }
    if (!genAI) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const data = await collectRingkasanData(instId);
    const prompt = buildPrompt(data);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`)
          );
        };
        try {
          send({ step: "collecting", message: "Data agregasi dimuat." });
          send({ step: "generating", message: "AI menyusun ringkasan eksekutif..." });

          const model = genAI!.getGenerativeModel({
            model: "gemini-1.5-flash",
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
          });

          const result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
          });

          let fullText = "";
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            send({ step: "chunk", text });
          }

          const clean = enforceOutputLimits(fullText, 8000)
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          let parsed: any = null;
          try {
            parsed = JSON.parse(clean);
          } catch {
            parsed = { ringkasan_eksekutif: clean, poin_positif: [], area_perhatian: [], rekomendasi: [] };
          }

          send({ step: "complete", result: parsed });
          controller.close();
        } catch (err: any) {
          console.error("Ringkasan AI generation error:", err);
          send({ step: "error", message: err.message || "Gagal generate ringkasan" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("POST /api/institution/[institutionId]/ai-ringkasan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}