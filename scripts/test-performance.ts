/**
 * Test Performance
 * 
 * Script untuk menguji performa sistem:
 * - Response time untuk endpoint utama
 * - Database query performance
 * - Concurrency handling
 * - Large dataset handling
 */

import { Pool } from 'pg';
import axios from 'axios';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:nus4nt4r4@localhost:5432/gurupro_db';
const pool = new Pool({ connectionString: DATABASE_URL });

async function measureQueryTime(query: string, params: any[] = []): Promise<number> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query(query, params);
  } finally {
    client.release();
  }
  return Date.now() - start;
}

async function testPerformance() {
  console.log('⚡ Testing System Performance...\n');

  try {
    console.log('🔍 Retrieving test data for Performance Testing...');
    
    // Ambil user untuk pengujian
    const userResult = await pool.query(`
      SELECT u.id, u.email, u.nama_lengkap, u.role
      FROM users u
      WHERE u.email LIKE 'TEST_%'
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('⚠️  No test users found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Test User: ${user.nama_lengkap} (ID: ${user.id})\n`);

    // Ambil institusi tempat user aktif
    const instResult = await pool.query(`
      SELECT im.institution_id, i.name
      FROM public.institution_members im
      JOIN payload.institutions i ON i.id = im.institution_id
      WHERE im.app_user_id = $1
      LIMIT 1
    `, [user.id]);
    
    if (instResult.rows.length === 0) {
      console.log('⚠️  User does not belong to any institution');
      return;
    }
    
    const institution = instResult.rows[0];
    console.log(`Institution: ${institution.name} (ID: ${institution.institution_id})\n`);

    // Tes 1: Database query performance
    console.log('🗄️  Test 1: Database Query Performance...');
    
    // Uji query sederhana
    const simpleQueryTime = await measureQueryTime('SELECT 1');
    console.log(`   Simple query (SELECT 1): ${simpleQueryTime}ms`);
    
    // Uji query kompleks untuk dashboard guru
    const dashboardQueryTime = await measureQueryTime(`
      SELECT 
        u.nama_lengkap,
        a.date,
        a.attendance_status,
        t.session_date,
        t.status as teaching_status
      FROM users u
      LEFT JOIN attendance_summary a ON a.teacher_id = u.id
      LEFT JOIN teaching_sessions t ON t.user_id = u.id
      WHERE u.id = $1
      LIMIT 10
    `, [user.id]);
    console.log(`   Dashboard query (attendance + teaching): ${dashboardQueryTime}ms`);
    
    // Uji query untuk e-raport dengan join kompleks
    const raportQueryTime = await measureQueryTime(`
      SELECT 
        dr.id,
        s.nama_siswa AS student_name,
        c.nama_kelas
      FROM data_raport dr
      JOIN students s ON s.id = dr.siswa_id
      JOIN classes c ON c.id = dr.kelas_id
      JOIN schools sch ON sch.id = c.school_id
      WHERE sch.user_id = $1
      LIMIT 10
    `, [user.id]);
    console.log(`   E-Raport query (complex joins): ${raportQueryTime}ms`);
    
    // Uji query untuk TPG
    const tpgQueryTime = await measureQueryTime(`
      SELECT 
        ts.user_id,
        ts.session_date,
        ts.status,
        a.date,
        a.attendance_status
      FROM teaching_sessions ts
      LEFT JOIN attendance_summary a ON a.teacher_id = ts.user_id
      WHERE ts.user_id = $1
      LIMIT 20
    `, [user.id]);
    console.log(`   TPG query (teaching + attendance): ${tpgQueryTime}ms`);
    console.log('');

    // Tes 2: Data volume performance
    console.log('📈 Test 2: Large Dataset Handling...');
    
    // Hitung jumlah data besar
    const attendanceCountResult = await pool.query('SELECT COUNT(*) as count FROM attendance_summary');
    const teachingSessionsCountResult = await pool.query('SELECT COUNT(*) as count FROM teaching_sessions');
    const raportCountResult = await pool.query('SELECT COUNT(*) as count FROM data_raport');
    const studentsCountResult = await pool.query('SELECT COUNT(*) as count FROM students');
    
    console.log(`   Attendance records: ${attendanceCountResult.rows[0].count}`);
    console.log(`   Teaching sessions: ${teachingSessionsCountResult.rows[0].count}`);
    console.log(`   Raport records: ${raportCountResult.rows[0].count}`);
    console.log(`   Student records: ${studentsCountResult.rows[0].count}`);
    
    // Uji query dengan hasil banyak
    const manyResultsQueryTime = await measureQueryTime(`
      SELECT *
      FROM attendance_summary
      LIMIT 1000
    `);
    console.log(`   Query 1000 attendance records: ${manyResultsQueryTime}ms`);
    
    const manyRaportQueryTime = await measureQueryTime(`
      SELECT *
      FROM data_raport
      LIMIT 1000
    `);
    console.log(`   Query 1000 raport records: ${manyRaportQueryTime}ms`);
    console.log('');

    // Tes 3: Concurrency simulation
    console.log('👥 Test 3: Concurrency Simulation...');
    
    // Simulasikan beberapa request bersamaan
    const concurrencyStart = Date.now();
    const concurrentRequests = [];
    
    for (let i = 0; i < 5; i++) {
      concurrentRequests.push(measureQueryTime(`
        SELECT u.nama_lengkap, count(a.id) as attendance_count
        FROM users u
        LEFT JOIN attendance_summary a ON a.teacher_id = u.id
        WHERE u.id = $1
        GROUP BY u.id, u.nama_lengkap
      `, [user.id]));
    }
    
    const concurrencyResults = await Promise.all(concurrentRequests);
    const concurrencyTotalTime = Date.now() - concurrencyStart;
    
    console.log(`   5 concurrent queries average: ${(concurrencyResults.reduce((a, b) => a + b, 0) / concurrencyResults.length).toFixed(2)}ms`);
    console.log(`   5 concurrent queries total: ${concurrencyTotalTime}ms`);
    console.log('');

    // Tes 4: Cache effectiveness (jika ada cache di sistem)
    console.log('💾 Test 4: Cache Effectiveness (Simulated)...');
    
    // Uji query yang sama dua kali untuk melihat efek cache
    const firstRunTime = await measureQueryTime(`
      SELECT *
      FROM attendance_summary
      WHERE institution_id = $1
      LIMIT 100
    `, [institution.institution_id]);
    
    const secondRunTime = await measureQueryTime(`
      SELECT *
      FROM attendance_summary
      WHERE institution_id = $1
      LIMIT 100
    `, [institution.institution_id]);
    
    console.log(`   First query execution: ${firstRunTime}ms`);
    console.log(`   Second query execution: ${secondRunTime}ms`);
    console.log(`   Performance improvement: ${((firstRunTime - secondRunTime) / firstRunTime * 100).toFixed(2)}%`);
    console.log('');

    // Tes 5: Endpoint response time (jika server sedang berjalan)
    console.log('🌐 Test 5: Endpoint Response Time...');
    console.log('   Note: This test requires the server to be running on http://localhost:3000');
    
    try {
      // Coba akses API endpoint (jika server berjalan)
      const startTime = Date.now();
      const response = await axios.get('http://localhost:3000/api/health', {
        timeout: 5000 // 5 detik timeout
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`   Health check endpoint: ${responseTime}ms (Status: ${response.status})`);
    } catch (error) {
      console.log('   Health check failed - server might not be running on port 3000');
      console.log('   To run the server: npm run dev');
    }
    
    try {
      // Coba akses dashboard endpoint (jika server berjalan)
      const startTime = Date.now();
      const response = await axios.get(`http://localhost:3000/api/attendance/teacher-dashboard?institutionId=${institution.institution_id}`, {
        timeout: 10000, // 10 detik timeout
        headers: {
          'Authorization': 'Bearer test-token' // Ini hanya untuk simulasi
        }
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`   Teacher dashboard endpoint: ${responseTime}ms (Status: ${response.status})`);
    } catch (error) {
      console.log('   Teacher dashboard endpoint test failed - server might not be running or requires authentication');
    }
    
    console.log('\n🎉 Performance test completed!');
    console.log('\n📋 PERFORMANCE METRICS SUMMARY:');
    console.log('   - Database query response times measured');
    console.log('   - Large dataset handling capability tested');
    console.log('   - Concurrency handling simulated');
    console.log('   - Cache effectiveness evaluated');
    console.log('   - API endpoint response times tested (when server available)');

  } catch (error) {
    console.error('❌ Error during Performance test:', error);
  }
}

// Jalankan tes
testPerformance()
  .then(() => console.log('\n🏁 Performance test completed'))
  .catch(err => console.error('💥 Performance test failed:', err))
  .finally(() => pool.end());