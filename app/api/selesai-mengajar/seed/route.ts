/**
 * Seed Test Data for Selesaikan Mengajar Feature
 *
 * Creates sample schedules, classes, and subjects for testing
 * Run this via: fetch('/api/selesai-mengajar/seed', { method: 'POST' })
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionCookie } from '@/lib/session-sign';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    return parseSessionCookie(sessionCookie.value);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const schoolId = user.school_id;

    if (!schoolId) {
      return NextResponse.json({
        error: 'User has no school_id. Please set up a school first.'
      }, { status: 400 });
    }

    // Get current day
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayIndex = new Date().getDay();
    const todayName = dayNames[todayIndex];

    // Check if schedules already exist for today
    const existingSchedules = await prisma.schedules.findMany({
      where: {
        school_id: schoolId,
        hari: todayName,
      },
    });

    if (existingSchedules.length > 0) {
      return NextResponse.json({
        message: 'Schedules already exist for today',
        count: existingSchedules.length,
        schedules: existingSchedules,
      });
    }

    // Check if we have classes
    let classes = await prisma.classes.findMany({
      where: { school_id: schoolId },
    });

    // Create sample classes if none exist
    if (classes.length === 0) {
      const createdClasses = await Promise.all([
        prisma.classes.create({
          data: { school_id: schoolId, nama_kelas: 'VII A' },
        }),
        prisma.classes.create({
          data: { school_id: schoolId, nama_kelas: 'VIII A' },
        }),
        prisma.classes.create({
          data: { school_id: schoolId, nama_kelas: 'IX A' },
        }),
      ]);
      classes = createdClasses;
    }

    // Check if we have subjects
    let subjects = await prisma.subjects.findMany({
      where: { school_id: schoolId },
    });

    // Create sample subjects if none exist
    if (subjects.length === 0) {
      const createdSubjects = await Promise.all([
        prisma.subjects.create({
          data: { school_id: schoolId, nama_mapel: 'Matematika' },
        }),
        prisma.subjects.create({
          data: { school_id: schoolId, nama_mapel: 'Bahasa Indonesia' },
        }),
        prisma.subjects.create({
          data: { school_id: schoolId, nama_mapel: 'IPA' },
        }),
      ]);
      subjects = createdSubjects;
    }

    // Create sample schedules for today
    const scheduleTimes = [
      { jam_mulai: '07:30', jam_selesai: '09:00' },
      { jam_mulai: '09:15', jam_selesai: '10:45' },
      { jam_mulai: '11:00', jam_selesai: '12:30' },
    ];

    const createdSchedules = [];

    for (let i = 0; i < Math.min(3, classes.length); i++) {
      const schedule = await prisma.schedules.create({
        data: {
          school_id: schoolId,
          class_id: classes[i % classes.length].id,
          subject_id: subjects[i % subjects.length].id,
          hari: todayName,
          jam_mulai: scheduleTimes[i].jam_mulai,
          jam_selesai: scheduleTimes[i].jam_selesai,
        },
      });
      createdSchedules.push(schedule);
    }

    return NextResponse.json({
      message: `Created ${createdSchedules.length} sample schedules for today (${todayName})`,
      today: todayName,
      schedules: createdSchedules,
      classes,
      subjects,
    });
  } catch (error: any) {
    console.error('Seed Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Get seed status and instructions
 */
export async function GET() {
  return NextResponse.json({
    usage: 'POST to this endpoint to create sample schedules for testing',
    description: 'Creates sample classes, subjects, and schedules for today if they do not exist',
  });
}
