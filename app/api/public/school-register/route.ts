import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validasi field wajib
    const { nama_lembaga, jenjang, naungan, email_kontak } = body;

    if (!nama_lembaga || !jenjang || !naungan || !email_kontak) {
      return NextResponse.json(
        { error: 'Field wajib belum lengkap: nama_lembaga, jenjang, naungan, email_kontak' },
        { status: 400 }
      );
    }

    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_kontak)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    // Cek duplikasi email yang masih pending
    const existing = await prisma.school_registrations.findFirst({
      where: {
        email_kontak: email_kontak,
        status: 'pending',
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email ini sudah memiliki pendaftaran yang sedang diproses. Silakan tunggu konfirmasi dari admin.' },
        { status: 409 }
      );
    }

    // Simpan pendaftaran
    const registration = await prisma.school_registrations.create({
      data: {
        nama_lembaga: body.nama_lembaga,
        npsn: body.npsn || null,
        jenjang: body.jenjang,
        naungan: body.naungan,
        alamat: body.alamat || null,
        nama_kepala_sekolah: body.nama_kepala_sekolah || null,
        email_kontak: body.email_kontak,
        whatsapp: body.whatsapp || null,
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pendaftaran berhasil dikirim! Tim kami akan menghubungi Anda dalam 1-3 hari kerja.',
      id: registration.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('School registration error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Silakan coba lagi nanti.' },
      { status: 500 }
    );
  }
}
