import { NextRequest, NextResponse } from 'next/server';
import { getPemetaanKolomProfile, upsertPemetaanKolomProfile, isPemetaanProfileExpired } from '@/lib/raport/kontak-eksternal-repository';
import { CreatePemetaanKolomInputSchema, UpdatePemetaanKolomInputSchema } from '@/lib/raport/schemas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sekolahId = searchParams.get('sekolahId');
    const jalurRegulasi = searchParams.get('jalurRegulasi');

    if (!sekolahId || !jalurRegulasi) {
      return NextResponse.json({ error: 'sekolahId dan jalurRegulasi wajib diisi' }, { status: 400 });
    }

    if (!['kemendikdasmen', 'kemenag'].includes(jalurRegulasi)) {
      return NextResponse.json({ error: 'jalurRegulasi harus kemendikdasmen atau kemenag' }, { status: 400 });
    }

    const profile = await getPemetaanKolomProfile(sekolahId, jalurRegulasi);

    if (!profile) {
      return NextResponse.json({ profile: null, expired: false }, { status: 200 });
    }

    const expired = isPemetaanProfileExpired(profile.last_validated_at);

    return NextResponse.json({
      profile: {
        id: profile.id,
        sekolahId: profile.sekolah_id,
        jalurRegulasi: profile.jalur_regulasi,
        urutanSiswa: profile.urutan_siswa,
        urutanKolom: profile.urutan_kolom,
        systemVersionCatatan: profile.system_version_catatan,
        lastValidatedAt: profile.last_validated_at,
      },
      expired,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreatePemetaanKolomInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { sekolahId, jalurRegulasi, urutanSiswa, urutanKolom, systemVersionCatatan } = parsed.data;

    const result = await upsertPemetaanKolomProfile({
      sekolahId,
      jalurRegulasi,
      urutanSiswa,
      urutanKolom,
      systemVersionCatatan,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const sekolahId = searchParams.get('sekolahId');
    const jalurRegulasi = searchParams.get('jalurRegulasi');

    if (!sekolahId || !jalurRegulasi) {
      return NextResponse.json({ error: 'sekolahId dan jalurRegulasi wajib diisi' }, { status: 400 });
    }

    const parsed = UpdatePemetaanKolomInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const existing = await getPemetaanKolomProfile(sekolahId, jalurRegulasi);
    if (!existing) {
      return NextResponse.json({ error: 'Profil pemetaan kolom belum ada. Buat terlebih dahulu.' }, { status: 404 });
    }

    const profile = await upsertPemetaanKolomProfile({
      sekolahId,
      jalurRegulasi,
      urutanSiswa: parsed.data.urutanSiswa || existing.urutan_siswa,
      urutanKolom: parsed.data.urutanKolom || existing.urutan_kolom,
      systemVersionCatatan: parsed.data.systemVersionCatatan || existing.system_version_catatan,
    });

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
