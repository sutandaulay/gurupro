/**
 * API Route: /api/laporan-kinerja/[id]/download
 * Download laporan kinerja as DOCX (proper Word format)
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSessionFromCookieHeader } from '@/lib/session-sign'
import {
  escapeHtml,
  escapeHtmlPlain,
  formatTanggalIndonesia,
  getTahunAjaranDariTanggal,
  getSemesterDariTanggal,
  buildKopSekolahHTML,
  buildIdentitasTableHTML,
  buildSignatureBlockHTML,
  buildDocumentFooterHTML,
  buildWordDocTemplate,
  newlinesToBulletList,
  BRAND_DISCLAIMER,
} from '@/lib/export/document-shared'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionData = getSessionFromCookieHeader(req.headers.get('cookie'))

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guruId = sessionData.id

    const userDb = await query("SELECT role, status_langganan, subscription_end FROM users WHERE id = $1", [guruId])
    const user = userDb.rows[0]
    const isPro = user?.status_langganan && user.status_langganan !== 'free'
    const isExpired = isPro && user.subscription_end && new Date(user.subscription_end).getTime() < Date.now()

    if (isExpired && user.role !== 'admin') {
      return NextResponse.json({ error: 'Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mencetak atau mengunduh laporan kinerja.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'docx'

    const result = await query(
      `SELECT l.*, u.nama_lengkap, u.nip
       FROM laporan_kinerja l
       JOIN users u ON u.id = l.guru_id
       WHERE l.id = $1 AND l.guru_id = $2`,
      [id, guruId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    }

    const laporan = result.rows[0]
    const content = typeof laporan.content === 'string'
      ? JSON.parse(laporan.content)
      : laporan.content

    const sekolah = content?.identitas?.sekolah || ''
    const downloadDate = new Date(laporan.created_at || downloadDate)
    const tahunAjaran = getTahunAjaranDariTanggal(downloadDate)
    const semester = getSemesterDariTanggal(downloadDate)
    const semesterLabel = semester === 'ganjil' ? 'Ganjil' : 'Genap'

    const html = generateHTMLContent(laporan, content, sekolah, guruId, tahunAjaran, semesterLabel, downloadDate)

    const contentType = format === 'docx'
      ? 'application/msword'
      : 'text/html; charset=utf-8'
    const extension = format === 'docx' ? 'doc' : 'html'
    const filename = `LaporanKinerja_${(laporan.nama_lengkap || 'Guru').replace(/\s+/g, '_')}_${semesterLabel}_${tahunAjaran.replace('/', '-')}.${extension}`

    return new Response(html, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('GET /api/laporan-kinerja/[id]/download error:', err)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}

function generateHTMLContent(
  laporan: any,
  content: any,
  sekolah: string,
  guruId: string,
  tahunAjaran: string,
  semesterLabel: string,
  downloadDate: Date,
): string {
  const guruNama = escapeHtml(content?.identitas?.nama || laporan.nama_lengkap || '-')
  const guruNip = escapeHtml(content?.identitas?.nip || laporan.nip || '')

  // --- Kop Sekolah ---
  const kopHtml = sekolah
    ? buildKopSekolahHTML({ nama_sekolah: sekolah })
    : ''

  // --- Identitas ---
  const identitasRows: [string, string][] = [
    ['Nama Guru', guruNama],
    ['NIP', guruNip || '-'],
    ['Mata Pelajaran', escapeHtml(content?.identitas?.mata_pelajaran || '-')],
    ['Kelas', escapeHtml(content?.identitas?.kelas || '-')],
    ['Sekolah', escapeHtml(sekolah || '-')],
    ['Periode', escapeHtml(content?.identitas?.periode || '-')],
  ]
  const identitasHtml = buildIdentitasTableHTML(identitasRows, { col1Width: 170 })

  // --- Sections ---
  const sectionsHtml = (content?.sections || []).map((section: any) => {
    const heading = escapeHtml(section.heading || '')
    if (!section.content?.trim()) return ''

    // Check if content has bullet/numbered patterns
    const lines = section.content.split('\n').filter((p: string) => p.trim())
    const isBulletContent = lines.every((l: string) => /^[-\d.)\s]/.test(l.trim()))

    let contentHtml: string
    if (isBulletContent) {
      contentHtml = newlinesToBulletList(section.content, { ordered: /^\d/.test(lines[0]?.trim() || '') })
    } else {
      contentHtml = section.content
        .split('\n')
        .filter((l: string) => l.trim())
        .map((l: string) => `<p style="text-indent:1.5cm;margin:6px 0;text-align:justify;">${escapeHtml(l.trim())}</p>`)
        .join('\n')
    }

    return `
  <div class="section" style="margin-bottom:20px;page-break-inside:avoid;">
    <h2 style="font-size:13pt;margin:20px 0 10px;font-weight:bold;">${heading}</h2>
    ${contentHtml}
  </div>`
  }).join('')

  // --- Ringkasan ---
  const ringkasanHtml = content?.ringkasan_singkat
    ? `
  <div class="summary-box" style="border:2px solid #000;padding:16px;margin:20px 0;page-break-inside:avoid;background:#f9fafb;">
    <strong style="display:block;margin-bottom:8px;font-size:12pt;text-align:center;">Ringkasan</strong>
    <p style="margin:0;font-size:11pt;line-height:1.6;text-align:justify;">${escapeHtml(content.ringkasan_singkat)}</p>
  </div>`
    : ''

  // --- Tanda Tangan ---
  const signatureHtml = buildSignatureBlockHTML({
    guruNama: guruNama,
    guruNip: guruNip,
    kepalaNama: '_____________________',
    kepalaNip: undefined,
    lokasi: sekolah || '',
    tanggal: formatTanggalIndonesia(downloadDate),
  })

  // --- Footer ---
  const footerHtml = buildDocumentFooterHTML({
    showPageNumber: false,
    showDisclaimer: true,
    showDate: true,
    tanggal: formatTanggalIndonesia(downloadDate),
  })

  // --- Body ---
  const body = `
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:16pt;font-weight:bold;text-transform:uppercase;margin:0 0 4px;">Laporan Kinerja Guru</h1>
    <p style="margin:0;font-size:12pt;">Semester ${semesterLabel} Tahun Pelajaran ${tahunAjaran}</p>
    ${laporan.predikat ? `<p style="margin:8px 0 0;font-size:12pt;font-weight:bold;">Predikat: ${escapeHtml(laporan.predikat)}</p>` : ''}
  </div>

  ${kopHtml}

  <div style="margin-top:8px;">
    <h2 style="font-size:13pt;margin:16px 0 8px;font-weight:bold;">A. Identitas Guru</h2>
    ${identitasHtml}
  </div>

  ${sectionsHtml}

  ${ringkasanHtml}

  ${signatureHtml}

  ${footerHtml}`

  return buildWordDocTemplate(body, `Laporan Kinerja - ${guruNama}`)
}
