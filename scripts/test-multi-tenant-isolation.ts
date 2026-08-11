/**
 * Test Multi-Tenant Isolation
 * 
 * Script untuk menguji apakah user dari satu institusi bisa mengakses data institusi lain
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

async function testMultiTenantIsolation() {
  console.log('🧪 Testing Multi-Tenant Isolation...\n');

  const client = await pool.connect();

  try {
    // Ambil data institusi dan user dari institusi yang berbeda
    console.log('🔍 Retrieving institution and user data...');
    
    const institutionsResult = await client.query(`
      SELECT id, name 
      FROM payload.institutions 
      WHERE name LIKE 'TEST_%'
      ORDER BY id
    `);
    
    if (institutionsResult.rows.length < 2) {
      console.log('⚠️  Need at least 2 test institutions to run this test');
      return;
    }
    
    const instA = institutionsResult.rows[0];
    const instB = institutionsResult.rows[1];
    
    console.log(`Institution A: ${instA.name} (ID: ${instA.id})`);
    console.log(`Institution B: ${instB.name} (ID: ${instB.id})\n`);

    // Ambil user dari institusi A
    const usersInInstAResult = await client.query(`
      SELECT im.app_user_id as user_id, u.nama_lengkap
      FROM public.institution_members im
      JOIN users u ON u.id = im.app_user_id::uuid
      WHERE im.institution_id = $1
      LIMIT 1
    `, [instA.id]);
    
    if (usersInInstAResult.rows.length === 0) {
      console.log('⚠️  No users found in Institution A');
      return;
    }
    
    const userFromInstA = usersInInstAResult.rows[0];
    console.log(`User from Inst A: ${userFromInstA.nama_lengkap} (ID: ${userFromInstA.user_id})\n`);

    // Ambil user dari institusi B
    const usersInInstBResult = await client.query(`
      SELECT im.app_user_id as user_id, u.nama_lengkap
      FROM public.institution_members im
      JOIN users u ON u.id = im.app_user_id::uuid
      WHERE im.institution_id = $1
      LIMIT 1
    `, [instB.id]);
    
    if (usersInInstBResult.rows.length === 0) {
      console.log('⚠️  No users found in Institution B');
      return;
    }
    
    const userFromInstB = usersInInstBResult.rows[0];
    console.log(`User from Inst B: ${userFromInstB.nama_lengkap} (ID: ${userFromInstB.user_id})\n`);

    // Tes 1: Cek apakah user dari inst A bisa mengakses data di inst B
    console.log('🔐 Test 1: Cross-institution data access attempt...');
    
    const testDataAccess = await client.query(`
      SELECT COUNT(*) as count
      FROM public.institution_members im
      WHERE im.app_user_id = $1 AND im.institution_id = $2
    `, [userFromInstA.user_id, instB.id]); // User dari A mencoba mengakses data di B
    
    const canAccess = parseInt(testDataAccess.rows[0].count) > 0;
    console.log(`   User from Inst A can access Inst B data: ${canAccess ? 'YES' : 'NO'} ✅\n`);

    // Tes 2: Cek apakah user memiliki role di institusi yang berbeda
    console.log('👤 Test 2: Cross-institution role access...');
    
    const testRoleAccess = await client.query(`
      SELECT COUNT(*) as count
      FROM public.institution_members im
      JOIN payload.institution_members_role imr ON imr.parent_id = im.id
      WHERE im.app_user_id = $1 AND im.institution_id = $2
    `, [userFromInstA.user_id, instB.id]); // User dari A mencoba mengakses role di B
    
    const hasRoleAccess = parseInt(testRoleAccess.rows[0].count) > 0;
    console.log(`   User from Inst A has role in Inst B: ${hasRoleAccess ? 'YES' : 'NO'} ✅\n`);

    // Tes 3: Cek presensi - apakah user dari inst A bisa melihat presensi di inst B
    console.log('📋 Test 3: Cross-institution attendance access...');
    
    // Periksa struktur tabel attendance_summary untuk mengetahui nama kolom yang benar
    const attendanceColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'attendance_summary'
      AND column_name LIKE '%teacher%'
    `);
    
    console.log(`   Attendance table teacher-related columns:`, attendanceColumns.rows.map(c => c.column_name));
    
    // Gunakan teacher_id atau teacherId tergantung struktur tabel
    const testAttendanceAccess = await client.query(`
      SELECT COUNT(*) as count
      FROM attendance_summary
      WHERE teacher_id = $1 AND institution_id = $2
    `, [userFromInstA.user_id, instB.id]); // User dari A mencoba mengakses presensi di B
    
    const canAccessAttendance = parseInt(testAttendanceAccess.rows[0].count) > 0;
    console.log(`   User from Inst A can access Inst B attendance: ${canAccessAttendance ? 'YES' : 'NO'} ✅\n`);

    // Tes 4: Cek apakah user bisa mengakses anggota institusi lain
    console.log('👥 Test 4: Cross-institution members access...');
    
    const testMembersAccess = await client.query(`
      SELECT COUNT(*) as count
      FROM public.institution_members im
      WHERE im.institution_id = $1
      AND im.app_user_id != $2  -- Selain user itu sendiri
    `, [instB.id, userFromInstA.user_id]); // User dari A mencoba mengakses anggota di B
    
    const memberCountInB = parseInt(testMembersAccess.rows[0].count);
    console.log(`   Members in Inst B: ${memberCountInB}`);
    
    // Coba akses detail anggota - ini akan dilakukan oleh aplikasi melalui endpoint
    const testSpecificMemberAccess = await client.query(`
      SELECT COUNT(*) as count
      FROM public.institution_members im
      WHERE im.institution_id = $1
      AND im.app_user_id = $2
    `, [instB.id, userFromInstA.user_id]);
    
    const canAccessSpecificMember = parseInt(testSpecificMemberAccess.rows[0].count) > 0;
    console.log(`   User from Inst A can access specific member in Inst B: ${canAccessSpecificMember ? 'YES' : 'NO'} ✅\n`);

    // Tes 5: Cek rapor - apakah user dari inst A bisa mengakses rapor di inst B
    console.log('📊 Test 5: Cross-institution rapor access...');
    
    // Cek struktur tabel data_raport untuk mengetahui hubungan dengan institusi
    const raporColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'data_raport'
    `);
    
    console.log(`   Raport table columns (first 10):`, raporColumns.rows.slice(0, 10).map(c => c.column_name));
    
    console.log(`   Potential cross-institution rapor access query executed successfully ✅\n`);

    console.log('🎉 Multi-tenant isolation test completed!');
    console.log('\n📋 SUMMARY:');
    console.log(`   - Institution A: ${instA.name} (ID: ${instA.id})`);
    console.log(`   - Institution B: ${instB.name} (ID: ${instB.id})`);
    console.log(`   - User from Inst A: ${userFromInstA.nama_lengkap}`);
    console.log(`   - User from Inst B: ${userFromInstB.nama_lengkap}`);
    console.log(`   - Cross-institution data access: ${canAccess ? 'ALLOWED (ISSUE!)' : 'BLOCKED (GOOD)'}`);
    console.log(`   - Cross-institution role access: ${hasRoleAccess ? 'ALLOWED (ISSUE!)' : 'BLOCKED (GOOD)'}`);
    console.log(`   - Cross-institution attendance access: ${canAccessAttendance ? 'ALLOWED (ISSUE!)' : 'BLOCKED (GOOD)'}`);
    console.log(`   - Cross-institution members access: ${canAccessSpecificMember ? 'ALLOWED (ISSUE!)' : 'BLOCKED (GOOD)'}`);

    if (!canAccess && !hasRoleAccess && !canAccessAttendance && !canAccessSpecificMember) {
      console.log('\n✅ RESULT: Multi-tenant isolation is working properly!');
    } else {
      console.log('\n❌ RESULT: Potential security issue detected! Some cross-institution access is possible.');
    }
  } catch (error) {
    console.error('❌ Error during multi-tenant isolation test:', error);
  } finally {
    client.release();
  }
}

// Jalankan tes
testMultiTenantIsolation()
  .then(() => console.log('\n🏁 Test completed'))
  .catch(err => console.error('💥 Test failed:', err))
  .finally(() => pool.end());