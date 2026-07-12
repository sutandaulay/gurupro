import { generateAIContent } from "@/lib/ai";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserTokenAccess, consumeUserToken } from "@/lib/token-system";

export async function POST(req: Request) {
  try {
    // Auth check
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.id;

    // Token check
    const tokenAccess = await getUserTokenAccess(userId);
    if (!tokenAccess.access.allowed) {
      return NextResponse.json({
        error: "Token habis atau langganan expired",
        reason: tokenAccess.access.reason,
        remainingTokens: 0,
      }, { status: 403 });
    }

    const { formData, oldSoal } = await req.json();

    const mapel = formData.mapel || "Umum";
    const jenjang = formData.jenjang || "SD";
    const kelas = formData.kelas || "1";
    const topik = formData.topik || "";
    const kurikulumLabel = formData.kurikulumLabel || "Kurikulum Merdeka";
    const opsiPG = parseInt(formData.opsiPG) || 4;

    const tipe = oldSoal.tipe;
    const kognitif = oldSoal.kognitif || "C2";
    const tingkat = oldSoal.tingkat || "sedang";

    // Build format guides according to the question type
    let tipeGuide = "";
    let jsonTemplate = "";

    switch (tipe) {
      case 'pg':
        tipeGuide = `Pilihan Ganda Standar: Satu jawaban benar dari ${opsiPG} opsi. Opsi pengecoh harus masuk akal.`;
        jsonTemplate = `"opsi": ["A. ...", "B. ...", "C. ...", "D. ..."], "kunci": "A"`;
        break;
      case 'pg-kompleks':
        tipeGuide = `PG Kompleks: LEBIH DARI SATU jawaban benar. Contoh: "Pilih DUA jawaban yang benar..."`;
        jsonTemplate = `"opsi": ["A. ...", "B. ...", "C. ...", "D. ..."], "kunci": ["A", "C"]`;
        break;
      case 'bs':
        tipeGuide = `Benar/Salah: Pernyataan yang dijawab Benar atau Salah.`;
        jsonTemplate = `"opsi": ["Benar", "Salah"], "kunci": "Benar"`;
        break;
      case 'jodoh':
        tipeGuide = `Menjodohkan: Pasangkan kolom kiri dengan kolom kanan. Minimal 4-5 pasangan.`;
        jsonTemplate = `"opsi": {"kiri": ["1. Item A", "2. Item B", "3. Item C", "4. Item D"], "kanan": ["A. Pasangan 1", "B. Pasangan 2", "C. Pasangan 3", "D. Pasangan 4"]}, "kunci": {"1": "B", "2": "A", "3": "D", "4": "C"}`;
        break;
      case 'urutan':
        tipeGuide = `Urutan/Sequencing: Langkah-langkah yang harus disusun dalam urutan benar. Opsi diacak, kunci berisi urutan benar.`;
        jsonTemplate = `"opsi": ["Langkah X", "Langkah Y", "Langkah Z", "Langkah W"], "kunci": ["Langkah Y", "Langkah X", "Langkah Z", "Langkah W"]`;
        break;
      case 'tabel':
        tipeGuide = `Melengkapi Tabel: Isi bagian kosong (ditandai "?") dalam tabel.`;
        jsonTemplate = `"opsi": {"headers": ["Kolom 1", "Kolom 2", "Kolom 3"], "rows": [["Data A", "?", "Data C"], ["Data D", "Data E", "?"]]}, "kunci": {"row_1_col_2": "jawaban1", "row_2_col_3": "jawaban2"}`;
        break;
      case 'sebab-akibat':
        tipeGuide = `Sebab-Akibat: Hubungkan pernyataan dengan alasan. Pilihan jawaban wajib A-E standar sebab-akibat (A: Pernyataan benar, alasan benar, berhubungan; B: Benar, benar, tidak berhubungan; C: Pernyataan benar, alasan salah; D: Pernyataan salah, alasan benar; E: Keduanya salah).`;
        jsonTemplate = `"opsi": {"pernyataan": "Pernyataan yang diklaim...", "alasan": "Karena alasan ini..."}, "kunci": "A"`;
        break;
      case 'isian':
        tipeGuide = `Isian Singkat: Jawaban singkat 1-3 kata. Tidak ada opsi.`;
        jsonTemplate = `"opsi": null, "kunci": "jawaban singkat"`;
        break;
      case 'essay':
        tipeGuide = `Essay/Uraian: Jawaban panjang dengan poin-poin penilaian. Tidak ada opsi.`;
        jsonTemplate = `"opsi": null, "kunci": "Poin utama jawaban yang diharapkan..."`;
        break;
      default:
        tipeGuide = `Tipe soal standar.`;
        jsonTemplate = `"opsi": null, "kunci": "..."`;
    }

    let anbkInfo = "";
    if (oldSoal?.stimulus && oldSoal?.stimulus_id) {
      const stimulusText = String(oldSoal.stimulus || "").substring(0, 300);
      const levelAkm = oldSoal.level_akm || 'Cakap';
      anbkInfo = `
KONTEKS ANBK/AKM:
- Soal ini merupakan bagian dari ANBK/AKM
- Stimulus ID: ${oldSoal.stimulus_id}
- Level AKM: ${levelAkm}
- Pertahankan relevansi dengan stimulus berikut:
"${stimulusText}..."

Sertakan field tambahan di JSON:
"stimulus": "${String(oldSoal.stimulus || "").replace(/"/g, '\\"').substring(0, 300)}...",
"stimulus_id": "${oldSoal.stimulus_id}",
"level_akm": "${levelAkm}"`;
    }

    let bahasaDaerahInfo = "";
    const bahasaMatch = mapel.match(/^Bahasa\s+(.+)$/);
    const knownBahasa = ['Jawa', 'Sunda', 'Bali', 'Madura', 'Minangkabau', 'Bugis', 'Banjar', 'Betawi', 'Aceh', 'Batak', 'Sasak', 'Dayak', 'Gorontalo', 'Lampung'];
    if (bahasaMatch && knownBahasa.includes(bahasaMatch[1])) {
      const namaBahasa = bahasaMatch[1];
      bahasaDaerahInfo = `
ATURAN BAHASA DAERAH (WAJIB):
- Tulis SELURUH pertanyaan, opsi, kunci, dan pembahasan dalam Bahasa ${namaBahasa}
- Gunakan ejaan dan tata bahasa Bahasa ${namaBahasa} yang baku
- Field "indikator" boleh dalam Bahasa Indonesia`;
    }

    const prompt = `Anda adalah pembuat soal profesional Indonesia. Buatkan 1 soal pengganti dengan kriteria berikut:

IDENTITAS:
- Mata Pelajaran: ${mapel}
- Jenjang: ${jenjang} Kelas ${kelas}
- Topik: ${topik}
- Kurikulum: ${kurikulumLabel}

SOAL YANG HARUS DIGANTI:
- Tipe: ${tipe} (${tipeGuide})
- Level Kognitif: ${kognitif}
- Tingkat Kesulitan: ${tingkat}
${anbkInfo}
${bahasaDaerahInfo}

PENTING:
- Buat soal BERBEDA dari soal lama: "${String(oldSoal.pertanyaan || "").substring(0, 100)}..."
- Pertahankan tipe, level kognitif, dan tingkat kesulitan yang sama
- Nomor soal: ${oldSoal.nomor || 1}
- Format opsi dan kunci HARUS sesuai panduan tipe di atas
- Selalu isi field "elemen", "cp", "tp", dan "skor" untuk soal baru ini

Balas HANYA dalam format JSON (tanpa markdown):
{
  "nomor": ${oldSoal.nomor || 1},
  "tipe": "${tipe}",
  "pertanyaan": "...",
  ${jsonTemplate},
  "pembahasan": "...",
  "kognitif": "${kognitif}",
  "tingkat": "${tingkat}",
  "indikator": "...",
  "elemen": "...",
  "cp": "...",
  "tp": "...",
  "skor": ${oldSoal.skor || 1},
  "gambar": ${oldSoal.gambar ? `"${oldSoal.gambar}"` : "null"}
  ${oldSoal.stimulus_id && oldSoal.stimulus ? `, "stimulus": "${String(oldSoal.stimulus).replace(/"/g, '\\"')}", "stimulus_id": "${oldSoal.stimulus_id}", "level_akm": "${oldSoal.level_akm || 'Cakap'}"` : ""}
}`;

    // Call universal AI service
    let parsed: any;
    try {
      const text = await generateAIContent(prompt);
      const cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (aiError: any) {
      console.error("Regenerate Soal AI generation failed:", aiError);
      return NextResponse.json({ error: `Gagal memproses AI: ${aiError.message || aiError}` }, { status: 502 });
    }

    // Consume token after successful generation
    await consumeUserToken(userId, 1);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Regenerate API error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat soal pengganti" }, { status: 500 });
  }
}
