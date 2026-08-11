import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendInAppNotification } from '@/lib/institution-members';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const memberIdNum = parseInt(memberId, 10);

    if (isNaN(memberIdNum)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const member = await query(
      `SELECT im.app_user_id, im.status, i.name as institution_name
       FROM public.institution_members im
       JOIN institutions i ON i.id = im.institution_id
       WHERE im.id = $1
       LIMIT 1`,
      [memberIdNum]
    );

    if (member.rows.length === 0) {
      return NextResponse.json(
        { error: 'Anggota tidak ditemukan' },
        { status: 404 }
      );
    }

    const m = member.rows[0];

    if (m.status !== 'invited') {
      return NextResponse.json(
        { error: 'Notifikasi hanya dikirim untuk anggota dengan status invited' },
        { status: 409 }
      );
    }

    // Send in-app notification
    await sendInAppNotification(
      m.app_user_id,
      'Undangan Bergabung Institusi',
      `Anda telah diundang untuk bergabung dengan institusi "${m.institution_name}". Silakan masuk ke Dashboard untuk menerima atau menolak undangan.`,
      'invitation',
      'institution_invite',
      String(memberIdNum)
    );

    // TODO: Integrasi WhatsApp — placeholder
    console.log(`[TODO] Send WhatsApp notification to user ${m.app_user_id} about institution invitation`);

    // TODO: Integrasi Email — placeholder
    console.log(`[TODO] Send Email notification to user ${m.app_user_id} about institution invitation`);

    return NextResponse.json({
      message: 'Notifikasi undangan berhasil dikirim (in-app)',
      note: 'Integrasi WA/email: TODO — placeholder',
    });
  } catch (error: any) {
    console.error('Notify error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
