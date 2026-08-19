import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { getUserTokenAccess } from "@/lib/token-system";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { findOrCreateCmsUser } from "@/lib/institution-members";

// ==========================================
// GET /api/bahan-ajar/[id]/export
// Export Bahan Ajar ke PDF/DOCX/PPTX
// ==========================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "docx";
    const jenis = searchParams.get("jenis") || "lkpd";

    // Validasi format
    const validFormats = ["pdf", "docx", "pptx"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Format tidak valid. Valid: ${validFormats.join(", ")}` },
        { status: 400 }
      );
    }

    // Validasi jenis
    const validJenis = ["slide", "lkpd", "handout"];
    if (!validJenis.includes(jenis)) {
      return NextResponse.json(
        { error: `Jenis tidak valid. Valid: ${validJenis.join(", ")}` },
        { status: 400 }
      );
    }

    // Auth
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Sesi tidak aktif. Silakan login kembali." },
        { status: 401 }
      );
    }
    const userId = session.id;

    // Get user details from users table to sync with cms_users
    const userRes = await query(
      "SELECT id, email, nama_lengkap FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }
    const user = userRes.rows[0];

    // Find or create the cms_users ID
    const cmsUserId = await findOrCreateCmsUser({
      id: user.id,
      email: user.email,
      nama_lengkap: user.nama_lengkap,
    });

    // Token validation
    const tokenState = await getUserTokenAccess(userId);
    if (!tokenState.user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // Get Payload instance
    const payload = await getPayload();

    // Ambil bahan ajar
    const bahanAjar = await payload.findByID({
      collection: "bahan-ajar",
      id,
      depth: 2,
    });

    if (!bahanAjar) {
      return NextResponse.json(
        { error: "Bahan Ajar tidak ditemukan." },
        { status: 404 }
      );
    }

    // Guard: cek kepemilikan
    const guruId = typeof bahanAjar.guru === 'object'
      ? (bahanAjar.guru as any)?.id
      : bahanAjar.guru;

    if (guruId !== cmsUserId) {
      if (tokenState.user.role !== "admin") {
        return NextResponse.json(
          { error: "Anda bukan pemilik Bahan Ajar ini." },
          { status: 403 }
        );
      }
    }

    // Cek subscription untuk export (PRO requirement)
    const isPro = tokenState.user.status_langganan && tokenState.user.status_langganan !== "free";
    const isExpired = isPro && tokenState.user.subscription_end
      && new Date(tokenState.user.subscription_end).getTime() < Date.now();

    if (isExpired && tokenState.user.role !== "admin") {
      return NextResponse.json(
        { error: "Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mengunduh." },
        { status: 403 }
      );
    }

    // Fetch school info for kop sekolah
    const schoolId = modulAjar?.school_id;
    let schoolData: any = { nama_sekolah: null, alamat: null, npsn: null, logo: null, nama_kepala_sekolah: null, nip_kepala_sekolah: null, kepala_signature_url: null };
    if (schoolId) {
      try {
        const schoolRes = await query(
          `SELECT s.nama_sekolah, s.alamat, s.npsn, s.logo,
                  i.nama_kepala_sekolah, i.nip_kepala_sekolah,
                  ks.signature_url AS kepala_signature_url
           FROM schools s
           LEFT JOIN institutions i ON i.school_id = s.id
           LEFT JOIN users ks ON ks.nama_sekolah = s.nama_sekolah AND ks.role = 'kepala_sekolah'
           WHERE s.id = $1`,
          [schoolId]
        );
        if (schoolRes.rows[0]) schoolData = schoolRes.rows[0];
      } catch (_) {}
    }

    // Fetch user info for signature
    let userInfo: any = { nama_lengkap: null, nip: null, signature_url: null };
    try {
      const userRes = await query("SELECT nama_lengkap, nip, signature_url FROM users WHERE id = $1", [userId]);
      if (userRes.rows[0]) userInfo = userRes.rows[0];
    } catch (_) {}

    // Ambil modul ajar untuk metadata
    const modulAjar = bahanAjar.modulAjar as any;
    const modulTitle = modulAjar?.namaModul || "Modul Ajar";
    const mapel = modulAjar?.mapel || "Mata Pelajaran";
    const jenjang = modulAjar?.jenjang || "";
    const kelas = modulAjar?.kelas || "";
    const kurikulum = modulAjar?.jenisKurikulum === "kurikulum_merdeka" ? "Kurikulum Merdeka" : "K13";

    // Generate content based on jenis
    let content: any = null;
    let contentTitle = "";

    switch (jenis) {
      case "slide":
        content = bahanAjar.slidesOutline;
        contentTitle = "Slide Outline";
        break;
      case "lkpd":
        content = bahanAjar.lkpd;
        contentTitle = "Lembar Kerja Peserta Didik (LKPD)";
        break;
      case "handout":
        content = bahanAjar.handout;
        contentTitle = "Handout / Bahan Ajar Cetak";
        break;
    }

    if (!content) {
      return NextResponse.json(
        { error: `${jenis} belum tersedia. Generate terlebih dahulu.` },
        { status: 404 }
      );
    }

    // Generate file based on format and jenis
    let fileContent: string;
    let filename: string;
    let contentType: string;

    const safeTitle = modulTitle.replace(/[^a-zA-Z0-9]/g, "_");
    const safeJenis = jenis === "slide" ? "Slide" : jenis === "lkpd" ? "LKPD" : "Handout";

    if (format === "pptx" && jenis === "slide") {
      // Generate PPTX outline (OPML-based outline yang bisa di-import ke PowerPoint/Keynote)
      fileContent = generateSlideOutline(content, {
        title: modulTitle,
        mapel,
        jenjang,
        kelas,
      });
      filename = `${safeJenis}_${safeTitle}.xml`;
      contentType = "application/xml";
    } else {
      // Generate DOCX (HTML-based - same output format for LKPD and Handout)
      fileContent = generateDocContent(content, {
        jenis,
        title: modulTitle,
        mapel,
        jenjang,
        kelas,
        kurikulum,
        contentTitle,
        schoolData,
        userInfo,
      });
      filename = `${safeJenis}_${safeTitle}.doc`;
      contentType = "application/vnd.ms-word";
    }

    return new Response(fileContent, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("[BahanAjar] Export error:", error);

    return NextResponse.json(
      { error: error.message || "Gagal export bahan ajar" },
      { status: 500 }
    );
  }
}

// ==========================================
// Helper: Generate DOCX content (HTML-based)
// ==========================================

function generateDocContent(
  content: any,
  opts: {
    jenis: string;
    title: string;
    mapel: string;
    jenjang: string;
    kelas: string;
    kurikulum: string;
    contentTitle: string;
    schoolData?: any;
    userInfo?: any;
  }
): string {
  const { jenis, title, mapel, jenjang, kelas, kurikulum, contentTitle, schoolData, userInfo } = opts;

  let bodyContent = "";

  if (jenis === "lkpd") {
    bodyContent = generateLkpdHtml(content);
  } else if (jenis === "handout") {
    bodyContent = generateHandoutHtml(content);
  } else {
    bodyContent = `<pre>${JSON.stringify(content, null, 2)}</pre>`;
  }

  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Kop sekolah HTML
  const kopHtml = schoolData?.nama_sekolah ? (() => {
    const logoSection = schoolData.logo
      ? `<td style="width:60px;text-align:center;vertical-align:middle;"><img src="${schoolData.logo}" alt="Logo" style="max-height:60px;max-width:60px;object-fit:contain;" /></td>`
      : `<td style="width:60px;"></td>`;
    const alamatLine = schoolData.alamat ? `<p style="margin:2px 0;font-size:9pt;color:#555;">${schoolData.alamat}</p>` : '';
    const npsnLine = schoolData.npsn ? `<p style="margin:2px 0;font-size:9pt;">NPSN: ${schoolData.npsn}</p>` : '';
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>${logoSection}
        <td style="text-align:center;vertical-align:middle;">
          <h1 style="margin:0;font-size:15pt;font-weight:bold;color:#000;text-transform:uppercase;">${schoolData.nama_sekolah}</h1>
          ${alamatLine}${npsnLine}
        </td>
        <td style="width:60px;"></td>
      </tr>
    </table>
    <div style="border-bottom:2px solid #000;margin-bottom:16px;"></div>`;
  })() : '';

  // Signature block HTML
  const kepalaSigImg = schoolData?.kepala_signature_url
    ? `<img src="${schoolData.kepala_signature_url}" alt="Tanda Tangan" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;
  const guruSigImg = userInfo?.signature_url
    ? `<img src="${userInfo.signature_url}" alt="Tanda Tangan" style="height:60px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="height:60px;"></div>`;
  const tempatLine = schoolData?.nama_sekolah || '';
  const signatureHtml = (schoolData?.nama_kepala_sekolah || userInfo?.nama_lengkap) ? `
  <div style="margin-top:40px;page-break-inside:avoid;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${tempatLine}, ${today}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Kepala Sekolah,</p>
        <div style="height:8px;"></div>
        ${kepalaSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${schoolData?.nama_kepala_sekolah || '_____________________'}</p>
        <p style="margin:4px 0 0;font-size:10pt;">NIP. ${schoolData?.nip_kepala_sekolah || '_____________________'}</p>
      </div>
      <div style="text-align:center;width:45%;">
        <p style="margin:0 0 4px;font-size:11pt;">${tempatLine}, ${today}</p>
        <p style="margin:0 0 4px;font-size:11pt;">Guru,</p>
        <div style="height:8px;"></div>
        ${guruSigImg}
        <div style="height:4px;"></div>
        <p style="margin:0;font-size:11pt;text-decoration:underline;font-weight:bold;">${userInfo?.nama_lengkap || '_____________________'}</p>
        <p style="margin:4px 0 0;font-size:10pt;">NIP. ${userInfo?.nip || '_____________________'}</p>
      </div>
    </div>
  </div>` : '';

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - ${contentTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { margin: 2.5cm 2cm 2cm 3cm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #000; margin: 0; padding: 20px; }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
    h2 { font-size: 14pt; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12pt; margin-top: 16px; margin-bottom: 6px; }
    p { margin: 6px 0; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    .header { text-align: center; margin-bottom: 24px; }
    .header-line { border-bottom: 2px solid #000; margin-top: 8px; margin-bottom: 16px; }
    .meta-table { width: auto; margin: 0 auto 16px; }
    .meta-table td { padding: 2px 12px; }
    .meta-table td:first-child { font-weight: bold; text-align: right; }
    .footer { margin-top: 40px; text-align: center; font-size: 10pt; }
    .page-break { page-break-after: always; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
    .pertemuan { background: #f8f8f8; padding: 12px; margin: 12px 0; border-left: 3px solid #333; }
    .aktivitas { margin: 8px 0; padding: 8px; border: 1px solid #ddd; }
    .rubrik { font-size: 10pt; background: #fffde7; padding: 8px; margin-top: 8px; }
    @media print { body { padding: 0; } }
    .page-footer { position: fixed; bottom: 1.5cm; right: 2cm; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  ${kopHtml}

  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <p><strong>${contentTitle}</strong></p>
    <div class="header-line"></div>
  </div>

  <table class="meta-table">
    <tr><td>Mata Pelajaran</td><td>: ${escapeHtml(mapel)}</td></tr>
    <tr><td>Jenjang</td><td>: ${escapeHtml(jenjang)}${kelas ? ` / ${escapeHtml(kelas)}` : ''}</td></tr>
    <tr><td>Kurikulum</td><td>: ${escapeHtml(kurikulum)}</td></tr>
  </table>

  ${bodyContent}

  ${signatureHtml}

  <div class="footer">
    <p>Dokumen ini dihasilkan oleh <strong>GuruPRO AI</strong></p>
    <p>Dicetak pada ${today}</p>
  </div>
<div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
</body>
</html>`;
}

function generateLkpdHtml(lkpd: any): string {
  if (!lkpd || !lkpd.lkpd || !Array.isArray(lkpd.lkpd)) {
    return "<p>Data LKPD tidak tersedia.</p>";
  }

  return lkpd.lkpd.map((pertemuan: any, idx: number) => `
    <div class="pertemuan">
      <h2>Pertemuan ${pertemuan.pertemuan || idx + 1}: ${escapeHtml(pertemuan.judul || "LKPD")}</h2>

      ${pertemuan.tujuan ? `
        <h3>Tujuan Pembelajaran</h3>
        <ul>
          ${(Array.isArray(pertemuan.tujuan) ? pertemuan.tujuan : [pertemuan.tujuan])
            .map((t: string) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      ` : ""}

      ${pertemuan.keseimbangan ? `
        <p><strong>Keseimbangan Aktivitas:</strong>
          Olah Pikir ${pertemuan.keseimbangan.olah_pikir || "-"},
          Olah Hati ${pertemuan.keseimbangan.olah_hati || "-"},
          Olah Rasa ${pertemuan.keseimbangan.olah_rasa || "-"},
          Olah Raga ${pertemuan.keseimbangan.olah_raga || "-"}
        </p>
      ` : ""}

      ${pertemuan.aktivitas && Array.isArray(pertemuan.aktivitas) ? `
        <h3>Aktivitas</h3>
        ${pertemuan.aktivitas.map((akt: any, i: number) => `
          <div class="aktivitas">
            <p><strong>${i + 1}. ${escapeHtml(akt.tipe?.toUpperCase() || "AKTIVITAS")}</strong></p>
            <p>${escapeHtml(akt.instruksi || "")}</p>
            ${akt.pertanyaan_pemandu && Array.isArray(akt.pertanyaan_pemandu) ? `
              <p><em>Pertanyaan:</em></p>
              <ol>
                ${akt.pertanyaan_pemandu.map((q: string) => `<li>${escapeHtml(q)}</li>`).join("")}
              </ol>
            ` : ""}
            ${akt.ruang_jawaban ? `<p><em>Ruang Jawaban:</em> ${escapeHtml(akt.ruang_jawaban)}</p>` : ""}
            ${akt.rubrik_singkat ? `<div class="rubrik"><strong>Rubrik:</strong> ${escapeHtml(akt.rubrik_singkat)}</div>` : ""}
          </div>
        `).join("")}
      ` : ""}

      ${pertemuan.waktu_estimasi ? `<p><strong>Estimasi Waktu:</strong> ${escapeHtml(pertemuan.waktu_estimasi)}</p>` : ""}
    </div>
  `).join("<div class='page-break'></div>");
}

function generateHandoutHtml(handout: any): string {
  if (!handout) {
    return "<p>Data handout tidak tersedia.</p>";
  }

  // Handout could be a string (markdown) or rich text
  if (typeof handout === "string") {
    // Simple markdown-to-HTML conversion
    return convertMarkdownToHtml(handout);
  }

  // If it's rich text from Payload, extract the content
  if (typeof handout === "object" && handout.root) {
    return extractRichText(handout);
  }

  return "<p>Format handout tidak dikenali.</p>";
}

function convertMarkdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, "").trim();
      return `<pre>${escapeHtml(code)}</pre>`;
    })
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  return `<div class="handout-content"><p>${html}</p></div>`;
}

function extractRichText(richText: any): string {
  // Basic rich text extraction - in production, use proper rich text renderer
  if (!richText || !richText.root) return "<p>Tidak ada konten.</p>";

  function extractNode(node: any): string {
    if (!node) return "";

    if (typeof node === "string") return escapeHtml(node);

    if (node.type === "text") {
      let text = escapeHtml(node.text || "");
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      return text;
    }

    if (node.children) {
      const childrenHtml = node.children.map(extractNode).join("");
      switch (node.type) {
        case "paragraph": return `<p>${childrenHtml}</p>`;
        case "heading": return `<h${node.tag || 2}>${childrenHtml}</h${node.tag || 2}>`;
        case "list": return `<${node.tag || "ul"}>${childrenHtml}</${node.tag || "ul"}>`;
        case "list-item": return `<li>${childrenHtml}</li>`;
        default: return childrenHtml;
      }
    }

    return "";
  }

  return `<div class="rich-text-content">${extractNode(richText.root)}</div>`;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ==========================================
// Helper: Generate Slide Outline (XML format)
// ==========================================

function generateSlideOutline(
  slides: any,
  opts: {
    title: string;
    mapel: string;
    jenjang: string;
    kelas: string;
  }
): string {
  const { title, mapel, jenjang, kelas } = opts;
  const today = new Date().toISOString().split("T")[0];

  if (!slides || !slides.slides || !Array.isArray(slides.slides)) {
    return generateEmptySlideOutline(title, mapel, jenjang, kelas, today);
  }

  // Generate simple XML outline
  const slideItems = slides.slides.map((slide: any) => {
    const poinUtama = Array.isArray(slide.poin_utama)
      ? slide.poin_utama.map((p: string) => `      <point>${escapeXml(p)}</point>`).join("\n")
      : "";

    return `    <slide>
      <pertemuan>${slide.pertemuan || ""}</pertemuan>
      <judul>${escapeXml(slide.judul_slide || slide.judul || "Slide")}</judul>
${poinUtama}
      <visual>${escapeXml(slide.saran_visual || "")}</visual>
      <catatan>${escapeXml(slide.catatan_pengajar || "")}</catatan>
      <alokasi>${escapeXml(slide.alokasi_waktu || "")}</alokasi>
    </slide>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Slide Outline - Generated by GuruPRO AI
  Title: ${escapeXml(title)}
  Mata Pelajaran: ${escapeXml(mapel)}
  Jenjang: ${escapeXml(jenjang)}${kelas ? ` / ${escapeXml(kelas)}` : ""}
  Generated: ${today}
-->
<slides>
  <metadata>
    <title>${escapeXml(title)}</title>
    <mapel>${escapeXml(mapel)}</mapel>
    <jenjang>${escapeXml(jenjang)}</jenjang>
    <kelas>${escapeXml(kelas || "-")}</kelas>
    <generated>${today}</generated>
  </metadata>
  <outline>
${slideItems}
  </outline>
</slides>`;
}

function generateEmptySlideOutline(
  title: string,
  mapel: string,
  jenjang: string,
  kelas: string,
  today: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Slide Outline - Generated by GuruPRO AI
  Title: ${escapeXml(title)}
  Mata Pelajaran: ${escapeXml(mapel)}
  Jenjang: ${escapeXml(jenjang)}${kelas ? ` / ${escapeXml(kelas)}` : ""}
  Generated: ${today}
-->
<slides>
  <metadata>
    <title>${escapeXml(title)}</title>
    <mapel>${escapeXml(mapel)}</mapel>
    <jenjang>${escapeXml(jenjang)}</jenjang>
    <kelas>${escapeXml(kelas || "-")}</kelas>
    <generated>${today}</generated>
  </metadata>
  <outline>
    <!-- No slides available -->
  </outline>
</slides>`;
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
