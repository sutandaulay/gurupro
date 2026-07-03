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
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="LaporanKinerja_${(laporan.nama_lengkap || 'Guru').replace(/\s+/g, '_')}.html"`,
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
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    h1 { text-align: center; font-size: 18pt; margin-bottom: 10px; }
    h2 { font-size: 14pt; margin-top: 24px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    p { text-align: justify; margin: 12px 0; }
    .header { text-align: center; margin-bottom: 30px; }
    .meta { margin-bottom: 20px; }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 4px 8px; }
    .meta-table td:first-child { width: 150px; }
    .section { margin-bottom: 20px; }
    .footer { margin-top: 40px; text-align: right; }
    .summary { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>LAPORAN KINERJA GURU</h1>
    <p>Semester ${laporan.semester === 'ganjil' ? 'Ganjil' : 'Genap'} Tahun Pelajaran ${tahunAjaran}</p>
  </div>

  ${content?.identitas ? `
  <div class="meta">
    <h2>A. Identitas Guru</h2>
    <table class="meta-table">
      <tr><td>Nama</td><td>: ${content.identitas.nama || '-'}</td></tr>
      <tr><td>Mata Pelajaran</td><td>: ${content.identitas.mata_pelajaran || '-'}</td></tr>
      <tr><td>Kelas</td><td>: ${content.identitas.kelas || '-'}</td></tr>
      <tr><td>Sekolah</td><td>: ${content.identitas.sekolah || '-'}</td></tr>
      <tr><td>Periode</td><td>: ${content.identitas.periode || '-'}</td></tr>
    </table>
  </div>
  ` : ''}

  ${content?.sections?.map((section: any, i: number) => `
  <div class="section">
    <h2>${section.heading}</h2>
    <p>${section.content}</p>
  </div>
  `).join('') || ''}

  ${content?.ringkasan_singkat ? `
  <div class="summary">
    <strong>Ringkasan:</strong><br>
    ${content.ringkasan_singkat}
  </div>
  ` : ''}

  <div class="footer">
    <p>Dibuat pada: ${new Date(laporan.ai_generated_at || laporan.created_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}</p>
  </div>
</body>
</html>`
}
