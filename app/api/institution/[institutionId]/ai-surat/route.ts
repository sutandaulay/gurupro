import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isInstitutionFeatureEnabled } from "@/lib/feature-flags";
import {
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { enforceOutputLimits } from "@/lib/ai/limits";
import { getGeminiClient } from "@/lib/ai/generators";

// =====================================================
// AI Draf Surat — Kepala Sekolah & Wakasek
// Endpoint BARU, read-only (tidak menulis ke tabel existing).
// Generate draf surat dinas/edaran via Gemini (SSE streaming).
// Gate: feature flag command_center + RBAC leader.
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

async function getSchoolHeader(instId: number) {
  const res = await query(
    `SELECT s.nama_sekolah, s.alamat, s.npsn, s.logo, s.nama_kepala_sekolah, s.nip_kepala_sekolah,
            i.academic_year_active
     FROM institutions i
     JOIN schools s ON s.id = i.school_id
     WHERE i.id = $1`,
    [instId]
  );
  return res.rows[0] || {};
}

function buildPrompt(input: {
  jenis: string;
  perihal: string;
  tujuan: string;
  catatan: string;
  school: any;
}) {
  const { jenis, perihal, tujuan, catatan, school } = input;
  return `
Kamu adalah staf administrasi sekolah profesional di Indonesia. Buatkan DRAF SURAT ${jenis.toUpperCase()} yang lengkap, formal, dan siap diedit Kepala Sekolah.

KOP SURAT SEKOLAH:
- Nama Sekolah: ${school.nama_sekolah || "Sekolah"}
- Alamat: ${school.alamat || "-"}
- NPSN: ${school.npsn || "-"}
- Tahun Ajaran Aktif: ${school.academic_year_active || "-"}
- Nama Kepala Sekolah: ${school.nama_kepala_sekolah || "Kepala Sekolah"}
- NIP Kepala Sekolah: ${school.nip_kepala_sekolah || "-"}

DETAIL SURAT:
- Jenis: ${jenis}
- Perihal: ${perihal}
- Kepada / Tujuan: ${tujuan || "(tulis yang wajar sesuai jenis surat)"}
- Catatan / Poin isi tambahan: ${catatan || "-"}
- Tanggal: (gunakan "hari ini", jangan isi angka tanggal spesifik — biarkan placeholder [TANGGAL])

TUGAS:
1. Susun draf surat resmi Indonesia yang benar: kop, nomor surat placeholder ([NOMOR SURAT]), lampiran placeholder, perihal, tanggal placeholder, alamat tujuan, pembuka salam, isi 2-4 paragraf yang jelas dan profesional, penutup, serta bagian penandatanganan (Kepala Sekolah).
2. Gunakan bahasa Indonesia baku sesuai kaidah surat resmi.
3. Jika ada catatan tambahan, pastikan poin-poinnya masuk ke isi surat.
4. Jangan menambahkan fakta/data di luar yang diberikan.

FORMAT OUTPUT (JSON ketat, tanpa teks di luar JSON):
\`\`\`json
{
  "nomor_surat": "[NOMOR SURAT]",
  "lampiran": "1 (satu) berkas",
  "perihal": "${perihal}",
  "tanggal": "[TANGGAL]",
  "kepada": "${tujuan}",
  "pembuka": "paragraf pembuka...",
  "isi": ["paragraf 1...", "paragraf 2..."],
  "penutup": "paragraf penutup...",
  "tembusan": ["1.", "2."],
  "penandatangan": "${school.nama_kepala_sekolah || 'Kepala Sekolah'}",
  "nip": "${school.nip_kepala_sekolah || '-'}"
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
          message: "Draf Surat AI belum aktif untuk institusi ini. Aktifkan fitur Command Center terlebih dahulu.",
        },
        { status: 200 }
      );
    }
    const school = await getSchoolHeader(instId);
    const aiClient = await getGeminiClient();
    return NextResponse.json({
      featureEnabled: true,
      aiConfigured: Boolean(aiClient),
      school,
    });
  } catch (error: any) {
    console.error("GET /api/institution/[institutionId]/ai-surat error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
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
    const featureEnabled = await isInstitutionFeatureEnabled(instId, "command_center");
    if (!featureEnabled) {
      return NextResponse.json(
        { error: "Draf Surat AI belum aktif untuk institusi ini" },
        { status: 403 }
      );
    }
    const aiClient = await getGeminiClient();
    if (!aiClient) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const jenis = String(body.jenis || "dinas").trim();
    const perihal = String(body.perihal || "").trim();
    const tujuan = String(body.tujuan || "").trim();
    const catatan = String(body.catatan || "").trim();

    if (!perihal) {
      return NextResponse.json({ error: "Perihal surat wajib diisi" }, { status: 400 });
    }

    const school = await getSchoolHeader(instId);
    const prompt = buildPrompt({ jenis, perihal, tujuan, catatan, school });

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`)
          );
        };
        try {
          send({ step: "generating", message: "AI menyusun draf surat..." });

          const model = aiClient.genAI.getGenerativeModel({
            model: aiClient.modelName,
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
          });

          const result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
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
            parsed = {
              nomor_surat: "[NOMOR SURAT]",
              lampiran: "-",
              perihal,
              tanggal: "[TANGGAL]",
              kepada: tujuan,
              pembuka: clean,
              isi: [],
              penutup: "",
              tembusan: [],
              penandatangan: school.nama_kepala_sekolah || "Kepala Sekolah",
              nip: school.nip_kepala_sekolah || "-",
            };
          }

          send({ step: "complete", result: parsed });
          controller.close();
        } catch (err: any) {
          console.error("Draf Surat AI generation error:", err);
          send({ step: "error", message: err.message || "Gagal generate draf surat" });
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
    console.error("POST /api/institution/[institutionId]/ai-surat error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}