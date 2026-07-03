/**
 * Seed All Test Data for GuruPRO
 * Creates school, classes, subjects, and schedules for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData;
  } catch {
    return null;
  }
}

async function getSchoolIdForUser(userId: string): Promise<string | null> {
  // Try to find school by user_id
  const school = await prisma.schools.findFirst({
    where: { user_id: userId },
  });
  if (school) return school.id;

  // If not found, check if user has created any school through classes/subjects
  const userClass = await prisma.classes.findFirst({
    where: { schools: { user_id: userId } },
  });
  if (userClass) return userClass.school_id;

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userName = user.nama_lengkap || 'Guru Test';
    const userEmail = user.email || 'test@gurupro.com';

    // Get school ID for this user
    let schoolId = await getSchoolIdForUser(userId);

    // Get or create school for this user
    let school = schoolId
      ? await prisma.schools.findUnique({ where: { id: schoolId } })
      : await prisma.schools.findFirst({
          where: { user_id: userId },
        });

    if (!school) {
      // Create a new school
      school = await prisma.schools.create({
        data: {
          user_id: userId,
          nama_sekolah: 'SMP Negeri 1 Testing',
          alamat: 'Jl. Testing No. 1, Kota Test',
          npsn: '12345678',
          nama_kepala_sekolah: 'Drs. Kepala Sekolah',
          nip_kepala_sekolah: '1234567890',
        },
      });
    }
    schoolId = school.id;
    let classes = await prisma.classes.findMany({
      where: { school_id: schoolId },
    });

    if (classes.length === 0) {
      const classNames = ['VII A', 'VII B', 'VIII A', 'VIII B', 'IX A', 'IX B'];
      const createdClasses = await Promise.all(
        classNames.map((name) =>
          prisma.classes.create({
            data: { school_id: schoolId, nama_kelas: name },
          })
        )
      );
      classes = createdClasses;
    }

    // Get or create subjects
    let subjects = await prisma.subjects.findMany({
      where: { school_id: schoolId },
    });

    if (subjects.length === 0) {
      const subjectNames = [
        'Matematika',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'IPA',
        'IPS',
        'Pendidikan Agama',
        'PJOK',
        'Seni Budaya',
      ];
      const createdSubjects = await Promise.all(
        subjectNames.map((name) =>
          prisma.subjects.create({
            data: { school_id: schoolId, nama_mapel: name },
          })
        )
      );
      subjects = createdSubjects;
    }

    // Get current day and create schedules
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayIndex = new Date().getDay();
    const todayName = dayNames[todayIndex];
    const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    // Create schedules for today (if not exist)
    const existingTodaySchedules = await prisma.schedules.findMany({
      where: { school_id: schoolId, hari: todayName },
    });

    const createdSchedules = [];

    if (existingTodaySchedules.length === 0) {
      // Create 3 schedules for today
      const scheduleConfigs = [
        { jam_mulai: '07:30', jam_selesai: '09:00', classIdx: 0, subjectIdx: 0 },
        { jam_mulai: '09:15', jam_selesai: '10:45', classIdx: 0, subjectIdx: 2 },
        { jam_mulai: '11:00', jam_selesai: '12:30', classIdx: 2, subjectIdx: 3 },
      ];

      for (const config of scheduleConfigs) {
        if (classes[config.classIdx] && subjects[config.subjectIdx]) {
          const schedule = await prisma.schedules.create({
            data: {
              school_id: schoolId,
              class_id: classes[config.classIdx].id,
              subject_id: subjects[config.subjectIdx].id,
              hari: todayName,
              jam_mulai: config.jam_mulai,
              jam_selesai: config.jam_selesai,
            },
          });
          createdSchedules.push(schedule);
        }
      }
    }

    // Create some students for each class
    const allStudents = await prisma.students.findMany({
      where: { class_id: { in: classes.map((c) => c.id) } },
    });

    if (allStudents.length === 0) {
      const studentNames = [
        'Ahmad Fauzi',
        'Budi Santoso',
        'Dewi Lestari',
        'Eko Prasetyo',
        'Fitri Handayani',
        'Gunawan Wijaya',
        'Hesti Rahayu',
        'Indra Gunawan',
        'Joko Widodo',
        'Kartika Sari',
        'Lina Marlina',
        'Mahmud Efendi',
        'Nina Hartati',
        'Oscar Pratama',
        'Putri Ayu',
        'Qori Amelia',
        'Rudi Hermawan',
        'Siti Aminah',
        'Tono Supriyanto',
        'Umar Hasan',
        'Vina Marlina',
        'Wahyu Setiawan',
        'Xena Putri',
        'Yusuf Ibrahim',
        'Zahra Fatimah',
        'Adi Kusuma',
        'Bella Safitri',
        'Citra Dewi',
        'Dani Ramadhan',
        'Eka Putri',
        'Fajar Nugroho',
        'Galuh Permata',
      ];

      for (let i = 0; i < Math.min(classes.length * 5, studentNames.length); i++) {
        const classIdx = Math.floor(i / 5);
        if (classes[classIdx]) {
          await prisma.students.create({
            data: {
              class_id: classes[classIdx].id,
              nama_siswa: studentNames[i],
              nisn: `20240${String(i + 1).padStart(4, '0')}`,
              nomor_absen: (i % 5) + 1,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data test berhasil dibuat!',
      data: {
        school: school ? {
          id: school.id,
          nama_sekolah: school.nama_sekolah,
        } : null,
        classes: classes.map((c) => ({ id: c.id, nama_kelas: c.nama_kelas })),
        subjects: subjects.map((s) => ({ id: s.id, nama_mapel: s.nama_mapel })),
        schedules_today: existingTodaySchedules.length > 0
          ? existingTodaySchedules.length
          : createdSchedules.length,
        today: todayName,
      },
    });
  } catch (error: any) {
    console.error('Seed Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: 'POST to this endpoint to create all test data',
    description: 'Creates school, classes, subjects, students, and schedules for testing',
  });
}
