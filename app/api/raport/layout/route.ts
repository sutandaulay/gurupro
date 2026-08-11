import { NextResponse } from 'next/server';
import { query, logAudit } from '@/lib/db';
import { cookies } from 'next/headers';
import { requireSchoolAccess } from '@/lib/school-access';
import {
  createLayout,
  updateLayout,
  getLayoutById,
  getLayoutsByTemplate,
  getLayoutsBySekolah,
  deleteLayout,
} from '@/lib/raport/layout-repository';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const templateRaportId = searchParams.get('template_raport_id');
    const sekolahId = searchParams.get('sekolah_id');

    if (sekolahId) await requireSchoolAccess(sekolahId)

    if (id) {
      const layout = await getLayoutById(id);
      if (!layout) {
        return NextResponse.json({ error: 'Layout tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json(layout);
    }

    if (templateRaportId) {
      const layouts = await getLayoutsByTemplate(templateRaportId);
      return NextResponse.json(layouts);
    }

    if (sekolahId) {
      const layouts = await getLayoutsBySekolah(sekolahId);
      return NextResponse.json(layouts);
    }

    return NextResponse.json({ error: 'Parameter id, template_raport_id, atau sekolah_id wajib diisi' }, { status: 400 });
  } catch (error: any) {
    console.error('GET layout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    let { template_raport_id, sekolah_id, nama_layout, sections, created_by_wali_kelas_member_id } = body;

    if (!template_raport_id || !sekolah_id || !nama_layout || !sections) {
      return NextResponse.json({
        error: 'template_raport_id, sekolah_id, nama_layout, dan sections wajib diisi'
      }, { status: 400 });
    }

    if (!created_by_wali_kelas_member_id) {
      // Fallback: cari institution_members.id dari session user
      const memberLookup = await query(
        `SELECT id FROM public.institution_members WHERE app_user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      );
      if (memberLookup.rows.length > 0) {
        created_by_wali_kelas_member_id = memberLookup.rows[0].id;
      } else {
        return NextResponse.json({
          error: 'Anda belum terdaftar sebagai anggota sekolah. Hubungi admin untuk mendaftarkan Anda.'
        }, { status: 400 });
      }
    }

    const result = await createLayout({
      templateRaportId: template_raport_id,
      sekolahId: sekolah_id,
      namaLayout: nama_layout,
      sections,
      createdByWaliKelasMemberId: created_by_wali_kelas_member_id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit(userId, 'CREATE_LAYOUT_RAPORT', `Membuat layout raport: ${result.id}`);

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: any) {
    console.error('POST layout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const body = await req.json();
    const { id, nama_layout, sections } = body;

    if (!id) {
      return NextResponse.json({ error: 'id layout wajib diisi' }, { status: 400 });
    }

    const result = await updateLayout(id, {
      namaLayout: nama_layout,
      sections,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit(userId, 'UPDATE_LAYOUT_RAPORT', `Mengupdate layout raport: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT layout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('gurupro_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id layout wajib diisi' }, { status: 400 });
    }

    const result = await deleteLayout(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit(userId, 'DELETE_LAYOUT_RAPORT', `Menghapus layout raport: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE layout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
