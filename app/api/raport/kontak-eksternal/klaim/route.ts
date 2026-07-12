import { NextRequest, NextResponse } from 'next/server';
import { claimKontak, findKontakByWAOrEmail, getKontakById } from '@/lib/raport/kontak-eksternal-repository';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kontakId, claimedByMemberId } = body;

    if (!kontakId || !claimedByMemberId) {
      return NextResponse.json({ error: 'kontakId dan claimedByMemberId wajib diisi' }, { status: 400 });
    }

    const result = await claimKontak(kontakId, claimedByMemberId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const kontak = await getKontakById(kontakId);

    const relatedKontaks = await findKontakByWAOrEmail(
      kontak.kontak_wa || '',
      kontak.kontak_email || '',
      kontakId
    );

    const multipleGuru = relatedKontaks.length > 0;

    if (multipleGuru) {
      const uniqueGuruMapelIds = [...new Set(relatedKontaks.map((k: any) => k.guru_mapel_member_id))];

      await query(
        `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          claimedByMemberId,
          'Kontak Eksternal Terkait Ditemukan',
          `Terdeteksi ${uniqueGuruMapelIds.length} guru lain yang juga membagikan raport ke kontak yang sama.`,
          'info',
          'kontak_klaim',
          kontakId,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      multipleGuru,
      totalRelated: relatedKontaks.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
