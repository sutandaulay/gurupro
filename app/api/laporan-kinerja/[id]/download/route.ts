/**
 * API Route: /api/laporan-kinerja/[id]/download
 * Download laporan kinerja as PDF or DOCX
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
    const guruId = sessionData.id

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'docx'

    const result = await query(
      `SELECT l.*, u.nama_lengkap
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

    if (format === 'docx') {
      const html = generateHTMLContent(laporan, content)

      return new Response(html, {
        headers: {
          'Content-Type': 'application/vnd.ms-word',
          'Content-Disposition': `attachment; filename="LaporanKinerja_${(laporan.nama_lengkap || 'Guru').replace(/\s+/g, '_')}_${laporan.semester}.doc"`,
        },
      })
    }

    const html = generateHTMLContent(laporan, content)

    return new Response(html, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="LaporanKinerja_${(laporan.nama_lengkap || 'Guru').replace(/\s+/g, '_')}_${laporan.semester}.pdf"`,
      },
    })
  } catch (err) {
    console.error('GET /api/laporan-kinerja/[id]/download error:', err)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}

function generateHTMLContent(laporan: any, content: any): string {
  const tahunAjaran = '2024/2025'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${laporan.judul}</title>
  <style>
    @page { margin: 2.5cm 3cm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; max-width: 100%; padding: 0; margin: 0; line-height: 1.8; font-size: 12pt; color: #000; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; font-weight: bold; text-transform: uppercase; }
    h2 { font-size: 13pt; margin-top: 20px; margin-bottom: 10px; font-weight: bold; }
    h3 { font-size: 12pt; margin-top: 16px; margin-bottom: 8px; font-weight: bold; }
    p { text-align: justify; margin: 8px 0; text-indent: 1.5cm; }
    .header { text-align: center; margin-bottom: 30px; }
    .header-line { border-bottom: 2px solid #000; margin-top: 6px; margin-bottom: 20px; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .meta-table td { padding: 4px 6px; vertical-align: top; font-size: 12pt; }
    .meta-table td:first-child { width: 160px; font-weight: bold; }
    .section { margin-bottom: 16px; }
    .section p { text-indent: 1.5cm; }
    .footer { margin-top: 50px; page-break-inside: avoid; }
    .footer-table { width: 100%; margin-top: 30px; }
    .footer-table td { width: 50%; vertical-align: top; }
    .signature { margin-top: 80px; text-align: center; }
    .signature p { text-indent: 0; text-align: center; }
    .summary-box { border: 1px solid #000; padding: 16px; margin: 20px 0; page-break-inside: avoid; }
    .summary-box strong { display: block; margin-bottom: 8px; font-size: 12pt; text-align: center; }
    .summary-box p { text-indent: 0; }
    .predikat { text-align: center; margin: 16px 0; font-size: 13pt; font-weight: bold; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Laporan Kinerja Guru</h1>
    <p style="text-indent:0;text-align:center;">Semester ${laporan.semester === 'ganjil' ? 'Ganjil' : 'Genap'} Tahun Pelajaran ${tahunAjaran}</p>
    ${laporan.predikat ? `<div class="predikat">Predikat: ${laporan.predikat}</div>` : ''}
    <div class="header-line"></div>
  </div>

  ${content?.identitas ? `
  <div>
    <h2>A. Identitas Guru</h2>
    <table class="meta-table">
      <tr><td>Nama</td><td>: ${escapeHtml(content.identitas.nama || '-')}</td></tr>
      <tr><td>Mata Pelajaran</td><td>: ${escapeHtml(content.identitas.mata_pelajaran || '-')}</td></tr>
      <tr><td>Kelas</td><td>: ${escapeHtml(content.identitas.kelas || '-')}</td></tr>
      <tr><td>Sekolah</td><td>: ${escapeHtml(content.identitas.sekolah || '-')}</td></tr>
      <tr><td>Periode</td><td>: ${escapeHtml(content.identitas.periode || '-')}</td></tr>
    </table>
  </div>
  ` : ''}

  ${content?.sections?.map((section: any) => `
  <div class="section">
    <h2>${escapeHtml(section.heading)}</h2>
    ${section.content.split('\n').filter((p: string) => p.trim()).map((p: string) => `<p>${escapeHtml(p)}</p>`).join('\n')}
  </div>
  `).join('') || ''}

  ${content?.ringkasan_singkat ? `
  <div class="summary-box">
    <strong>Ringkasan</strong>
    <p>${escapeHtml(content.ringkasan_singkat)}</p>
  </div>
  ` : ''}

  <div class="footer">
    <div class="header-line"></div>
    <table class="footer-table">
      <tr>
        <td style="text-align:left;font-size:10pt;">
          <em>Dokumen ini dihasilkan secara otomatis oleh GuruPRO AI</em>
        </td>
        <td style="text-align:right;font-size:10pt;">
          ${new Date(laporan.ai_generated_at || laporan.created_at).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
