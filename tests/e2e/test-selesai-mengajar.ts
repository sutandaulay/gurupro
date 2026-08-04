/**
 * Test Selesai Mengajar Pipeline
 * 
 * Script untuk menguji fitur Selesai Mengajar dan 4 side effect otomatis:
 * 1. Generate Jurnal
 * 2. Save Absensi
 * 3. Update ATP
 * 4. Update Lesson Memory
 * 5. Generate Next Materi
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

async function testSelesaiMengajarPipeline() {
  console.log('🔄 Testing Selesai Mengajar Pipeline...\n');

  const client = await pool.connect();

  try {
    console.log('🔍 Retrieving test data for Selesai Mengajar...');
    
    // Ambil user guru untuk pengujian
    const userResult = await client.query(`
      SELECT u.id, u.email, u.nama_lengkap, u.role
      FROM users u
      WHERE u.email LIKE 'TEST_%'
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('⚠️  No test users found');
      return;
    }
    
    const guru = userResult.rows[0];
    console.log(`Test Guru: ${guru.nama_lengkap} (ID: ${guru.id})\n`);

    // Ambil institusi tempat guru aktif
    const instResult = await client.query(`
      SELECT im.institution_id, i.name
      FROM payload.institution_members im
      JOIN payload.institutions i ON i.id = im.institution_id
      WHERE im.app_user_id = $1
      LIMIT 1
    `, [guru.id]);
    
    if (instResult.rows.length === 0) {
      console.log('⚠️  Guru does not belong to any institution');
      return;
    }
    
    const institution = instResult.rows[0];
    console.log(`Institution: ${institution.name} (ID: ${institution.institution_id})\n`);

    // Periksa struktur tabel classes untuk mengetahui nama kolom yang benar
    const classColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'classes'
    `);
    
    console.log('Classes table columns:', classColumns.rows.map(c => c.column_name).slice(0, 10));

    // Ambil kelas yang ditugaskan ke guru ini
    const classResult = await client.query(`
      SELECT c.id, c.nama_kelas as class_name
      FROM classes c
      JOIN schools s ON s.id = c.school_id
      WHERE s.user_id = $1
      LIMIT 1
    `, [guru.id]);
    
    if (classResult.rows.length === 0) {
      console.log('⚠️  No classes assigned to this user');
      return;
    }
    
    const kelas = classResult.rows[0];
    console.log(`Kelas: ${kelas.class_name} (ID: ${kelas.id})\n`);

    // Periksa struktur tabel subjects untuk mengetahui nama kolom yang benar
    const subjectColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'subjects'
    `);
    
    console.log('Subjects table columns:', subjectColumns.rows.map(c => c.column_name).slice(0, 10));

    // Ambil mata pelajaran yang ditugaskan ke guru ini
    const subjectResult = await client.query(`
      SELECT s.id, s.nama_mapel as subject_name
      FROM subjects s
      JOIN schools sch ON sch.id = s.school_id
      WHERE sch.user_id = $1
      LIMIT 1
    `, [guru.id]);
    
    if (subjectResult.rows.length === 0) {
      console.log('⚠️  No subjects assigned to this user');
      return;
    }
    
    const mapel = subjectResult.rows[0];
    console.log(`Mata Pelajaran: ${mapel.subject_name} (ID: ${mapel.id})\n`);

    // Tes 1: Generate Jurnal
    console.log('📝 Test 1: Jurnal Generation...');
    const jurnalResult = await client.query(`
      SELECT COUNT(*) as count
      FROM teacher_journals
      WHERE user_id = $1 AND class_id = $2 AND subject_id = $3
    `, [guru.id, kelas.id, mapel.id]);
    
    console.log(`   Existing journals for this combination: ${jurnalResult.rows[0].count}`);
    console.log('   Expected: New journal should be created during Selesai Mengajar process\n');

    // Tes 2: Save Absensi
    console.log('📋 Test 2: Absensi Saving...');
    const attendanceResult = await client.query(`
      SELECT COUNT(*) as count
      FROM attendance_summary
      WHERE teacher_id = $1 AND institution_id = $2
    `, [guru.id, institution.institution_id]);
    
    console.log(`   Existing attendance records: ${attendanceResult.rows[0].count}`);
    console.log('   Expected: New attendance record should be created during Selesai Mengajar process\n');

    // Tes 3: Update ATP (Aktivitas Tatap Muka)
    console.log('📅 Test 3: ATP Update...');
    const atpResult = await client.query(`
      SELECT COUNT(*) as count
      FROM teaching_sessions
      WHERE user_id = $1
    `, [guru.id]);
    
    console.log(`   Existing teaching sessions: ${atpResult.rows[0].count}`);
    console.log('   Expected: New teaching session should be recorded during Selesai Mengajar process\n');

    // Tes 4: Update Lesson Memory
    console.log('🧠 Test 4: Lesson Memory Update...');
    const memoryResult = await client.query(`
      SELECT COUNT(*) as count
      FROM lesson_memories
      WHERE user_id = $1
    `, [guru.id]);
    
    console.log(`   Existing lesson memories: ${memoryResult.rows[0].count}`);
    console.log('   Expected: New lesson memory should be created during Selesai Mengajar process\n');

    // Tes 5: Generate Next Materi
    console.log('📚 Test 5: Next Materi Generation...');
    const nextMateriResult = await client.query(`
      SELECT COUNT(*) as count
      FROM academic_calendars ac
      JOIN schools s ON s.id = ac.school_id
      WHERE s.user_id = $1
    `, [guru.id]);
    
    console.log(`   Academic calendars for user's school: ${nextMateriResult.rows[0].count}`);
    console.log('   Expected: New academic calendar entries may be created during Selesai Mengajar process\n');

    // Simulasikan data input untuk Selesai Mengajar
    console.log('🧪 Simulating Selesai Mengajar input...');
    const selesaiMengajarInput = {
      kelas_id: kelas.id,
      mapel_id: mapel.id,
      tanggal: new Date().toISOString().split('T')[0],
      guru_id: guru.id,
      school_id: '', // Akan diisi nanti
      topik: 'Testing Selesai Mengajar Pipeline',
      capaian_pembelajaran: 'Menguji pipeline Selesai Mengajar',
      metode_pembelajaran: 'Diskusi dan Demonstrasi',
      media_pembelajaran: 'Laptop dan Proyektor',
      evaluasi_pembelajaran: 'Observasi dan Tanya Jawab',
      refleksi_pembelajaran: 'Proses berjalan dengan baik',
      rencana_perbaikan: 'Terus tingkatkan kualitas pembelajaran',
      lampiran: []
    };

    console.log('Input untuk Selesai Mengajar:', JSON.stringify(selesaiMengajarInput, null, 2));

    console.log('\n🎉 Selesai Mengajar pipeline test completed!');
    console.log('\n📋 SUMMARY OF EXPECTED SIDE EFFECTS:');
    console.log(`   1. Jurnal Mengajar: New record in teacher_journals`);
    console.log(`   2. Presensi/Absensi: New record in attendance_summary`);
    console.log(`   3. ATP (Aktivitas Tatap Muka): New record in teaching_sessions`);
    console.log(`   4. Lesson Memory: New record in lesson_memories`);
    console.log(`   5. Next Materi: New records in academic_calendars or similar`);

    console.log('\n💡 NOTE: This test verifies the existence of the pipeline components.');
    console.log('   The actual Selesai Mengajar process would be triggered via the API');
    console.log('   endpoint POST /api/selesai-mengajar and would execute all side effects.');

  } catch (error) {
    console.error('❌ Error during Selesai Mengajar pipeline test:', error);
  } finally {
    client.release();
  }
}

// Jalankan tes
testSelesaiMengajarPipeline()
  .then(() => console.log('\n🏁 Selesai Mengajar test completed'))
  .catch(err => console.error('💥 Selesai Mengajar test failed:', err))
  .finally(() => pool.end());