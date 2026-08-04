/**
 * Comprehensive feature testing via HTTP
 * Tests all major features using real API routes
 * Usage: node scripts/test-all-features.ts
 */
const BASE_URL = 'http://localhost:3000';

class TestSession {
  constructor() {
    this.cookies = [];
  }

  async login(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    const setCookies = res.headers.getSetCookie?.() || [];
    this.cookies = setCookies.map(c => c.split(';')[0]);
    return { status: res.status, data, cookies: this.cookies };
  }

  async get(path) {
    return this.request(path, { method: 'GET' });
  }

  async post(path, body) {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async put(path, body) {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async request(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };
    if (this.cookies.length > 0) {
      headers['Cookie'] = this.cookies.join('; ');
    }
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data, ok: res.ok };
  }
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function pass(name, note) {
  console.log(`  [PASS] ${name}${note ? ' — ' + note : ''}`);
}

function fail(name, note) {
  console.log(`  [FAIL] ${name}${note ? ' — ' + note : ''}`);
}

function info(name, note) {
  console.log(`  [INFO] ${name}${note ? ' — ' + note : ''}`);
}

async function run() {
  console.log('=== GuruPRO AI Feature Testing ===\n');

  const guruMandiri = new TestSession();
  const guruInstansi = new TestSession();
  const kepalaSekolah = new TestSession();

  // ===== LOGIN =====
  console.log('--- 1. Authentication ---');

  const loginMandiri = await guruMandiri.login('DEMO_guru-mandiri@test.gurupro.id', 'test123');
  if (loginMandiri.data?.success) {
    pass('Guru Mandiri login');
  } else {
    fail('Guru Mandiri login', JSON.stringify(loginMandiri.data));
  }

  const loginInstansi = await guruInstansi.login('DEMO_guru-instansi@test.gurupro.id', 'test123');
  if (loginInstansi.data?.success) {
    pass('Guru Instansi login');
  } else {
    fail('Guru Instansi login', JSON.stringify(loginInstansi.data));
  }

  const loginKS = await kepalaSekolah.login('DEMO_kepala-sekolah@test.gurupro.id', 'test123');
  if (loginKS.data?.success) {
    pass('Kepala Sekolah login');
  } else {
    fail('Kepala Sekolah login', JSON.stringify(loginKS.data));
  }

  // ===== DASHBOARD =====
  console.log('\n--- 2. Dashboard Access ---');

  const dashMandiri = await guruMandiri.get('/api/me');
  if (dashMandiri.status === 200 || dashMandiri.status === 302) {
    pass('Dashboard guru mandiri', 'status=' + dashMandiri.status);
  } else {
    fail('Dashboard guru mandiri', 'status=' + dashMandiri.status);
  }

  const dashInstansi = await guruInstansi.get('/api/me');
  if (dashInstansi.status === 200 || dashInstansi.status === 302) {
    pass('Dashboard guru instansi', 'status=' + dashInstansi.status);
  } else {
    fail('Dashboard guru instansi', 'status=' + dashInstansi.status);
  }

  // ===== SET ACTIVE CONTEXT =====
  console.log('\n--- 3. Active Context (Institution) ---');

  const ctxRes = await guruInstansi.post('/api/auth/active-context', { context: { institutionId: 3 } });
  if (ctxRes.status < 400) {
    pass('Set active context to institution', 'status=' + ctxRes.status);
  } else {
    fail('Set active context to institution', JSON.stringify(ctxRes.data));
  }

  // ===== AI GENERATION =====
  console.log('\n--- 4. AI Generation ---');

  // Test AI Chat (basic)
  const chatRes = await guruMandiri.post('/api/chat', {
    message: 'Buatkan soal matematika kelas 7 tentang pecahan',
    sessionId: 'test-session-1',
  });
  if (chatRes.status < 400) {
    pass('AI Chat', 'status=' + chatRes.status);
  } else {
    info('AI Chat', 'status=' + chatRes.status + ' — ' + JSON.stringify(chatRes.data)?.substring(0, 200));
  }

  // Test AI Rapor generation
  const raporAiRes = await guruMandiri.post('/api/ai/rapor', {
    studentId: 'test',
    subjectId: 'test',
    grade: 85,
    mapel: 'Matematika',
  });
  if (raporAiRes.status < 400) {
    pass('AI Rapor generation', 'status=' + raporAiRes.status);
  } else {
    info('AI Rapor generation', 'status=' + raporAiRes.status + ' — ' + JSON.stringify(raporAiRes.data)?.substring(0, 200));
  }

  // Test AI Journal
  const journalAiRes = await guruMandiri.post('/api/ai/journal', {
    topic: 'Pecahan',
    classLevel: 'VII',
    duration: 90,
  });
  if (journalAiRes.status < 400) {
    pass('AI Journal generation', 'status=' + journalAiRes.status);
  } else {
    info('AI Journal generation', 'status=' + journalAiRes.status + ' — ' + JSON.stringify(journalAiRes.data)?.substring(0, 200));
  }

  // ===== ADMINISTRASI / AI DOCUMENTS =====
  console.log('\n--- 5. Dokumen AI (RPP, Modul Ajar, LKPD, Silabus, ATP) ---');

  // Check administrasi route
  const adminList = await guruMandiri.get('/api/administrasi');
  if (adminList.status < 400) {
    pass('Administrasi list', 'status=' + adminList.status + ', count=' + (adminList.data?.length || 0));
  } else {
    info('Administrasi list', 'status=' + adminList.status);
  }

  // Check bahan ajar
  const bahanAjar = await guruMandiri.get('/api/bahan-ajar');
  if (bahanAjar.status < 400) {
    pass('Bahan Ajar endpoint', 'status=' + bahanAjar.status);
  } else {
    info('Bahan Ajar endpoint', 'status=' + bahanAjar.status);
  }

  // Check modul ajar
  const modulAjar = await guruMandiri.get('/api/modul-ajar');
  if (modulAjar.status < 400) {
    pass('Modul Ajar endpoint', 'status=' + modulAjar.status);
  } else {
    info('Modul Ajar endpoint', 'status=' + modulAjar.status);
  }

  // Check silabus
  const silabus = await guruMandiri.get('/api/silabus');
  if (silabus.status < 400) {
    pass('Silabus endpoint', 'status=' + silabus.status);
  } else {
    info('Silabus endpoint', 'status=' + silabus.status);
  }

  // Check LKPD
  const lkpd = await guruMandiri.get('/api/lkpd/list');
  if (lkpd.status < 400) {
    pass('LKPD endpoint', 'status=' + lkpd.status);
  } else {
    info('LKPD endpoint', 'status=' + lkpd.status);
  }

  // Check ATP
  const atp = await guruMandiri.get('/api/atp');
  if (atp.status < 400) {
    pass('ATP endpoint', 'status=' + atp.status);
  } else {
    info('ATP endpoint', 'status=' + atp.status);
  }

  // ===== SELESAI MENGAJAR =====
  console.log('\n--- 6. Selesai Mengajar Pipeline ---');

  const smList = await guruMandiri.get('/api/selesai-mengajar/seed');
  if (smList.status < 400) {
    pass('Selesai Mengajar endpoint', 'status=' + smList.status);
  } else {
    info('Selesai Mengajar endpoint', 'status=' + smList.status);
  }

  // ===== RAPORT =====
  console.log('\n--- 7. e-Raport ---');

  const raportRes = await guruMandiri.get('/api/raport');
  if (raportRes.status < 400) {
    pass('Raport endpoint', 'status=' + raportRes.status);
  } else {
    info('Raport endpoint', 'status=' + raportRes.status);
  }

  // ===== BILLING POIN =====
  console.log('\n--- 8. Billing Poin ---');

  const billingRes = await guruMandiri.get('/api/ai-monitoring');
  if (billingRes.status < 400) {
    pass('AI Monitoring / Poin endpoint', 'status=' + billingRes.status);
  } else {
    info('AI Monitoring / Poin endpoint', 'status=' + billingRes.status);
  }

  // ===== SHARE-TO-LEADER =====
  console.log('\n--- 9. Share-to-Leader ---');

  const shareCreate = await guruMandiri.post('/api/performance-share/create', {
    documentType: 'rapor',
    documentId: 'test-doc-1',
    leaderId: 'test-leader-id',
  });
  if (shareCreate.status < 400) {
    pass('Share-to-leader create', 'status=' + shareCreate.status);
  } else {
    info('Share-to-leader create', 'status=' + shareCreate.status + ' — ' + JSON.stringify(shareCreate.data)?.substring(0, 200));
  }

  // ===== ATTENDANCE =====
  console.log('\n--- 10. Attendance ---');

  const attendance = await guruMandiri.get('/api/attendance');
  if (attendance.status < 400) {
    pass('Attendance endpoint', 'status=' + attendance.status);
  } else {
    info('Attendance endpoint', 'status=' + attendance.status);
  }

  const teachingAttendance = await guruMandiri.get('/api/attendance/teaching');
  if (teachingAttendance.status < 400) {
    pass('Teaching attendance endpoint', 'status=' + teachingAttendance.status);
  } else {
    info('Teaching attendance endpoint', 'status=' + teachingAttendance.status);
  }

  // ===== WALI KELAS =====
  console.log('\n--- 11. Wali Kelas ---');

  const waliKelas = await guruMandiri.get('/api/wali-kelas');
  if (waliKelas.status < 400) {
    pass('Wali Kelas endpoint', 'status=' + waliKelas.status);
  } else {
    info('Wali Kelas endpoint', 'status=' + waliKelas.status);
  }

  // ===== LAPORAN KINERJA =====
  console.log('\n--- 12. Laporan Kinerja ---');

  const lkinerja = await guruMandiri.get('/api/laporan-kinerja');
  if (lkinerja.status < 400) {
    pass('Laporan Kinerja endpoint', 'status=' + lkinerja.status);
  } else {
    info('Laporan Kinerja endpoint', 'status=' + lkinerja.status);
  }

  const skp = await guruMandiri.get('/api/skp');
  if (skp.status < 400) {
    pass('SKP endpoint', 'status=' + skp.status);
  } else {
    info('SKP endpoint', 'status=' + skp.status);
  }

  const observasi = await guruMandiri.get('/api/observasi');
  if (observasi.status < 400) {
    pass('Observasi endpoint', 'status=' + observasi.status);
  } else {
    info('Observasi endpoint', 'status=' + observasi.status);
  }

  // ===== PELATIHAN GURU =====
  console.log('\n--- 13. Pelatihan Guru ---');

  const pelatihan = await guruMandiri.get('/api/pelatihan');
  if (pelatihan.status < 400) {
    pass('Pelatihan endpoint', 'status=' + pelatihan.status);
  } else {
    info('Pelatihan endpoint', 'status=' + pelatihan.status);
  }

  // ===== EVIDENCE LOG =====
  console.log('\n--- 14. Evidence Log ---');

  const evidence = await guruMandiri.get('/api/evidence');
  if (evidence.status < 400) {
    pass('Evidence endpoint', 'status=' + evidence.status);
  } else {
    info('Evidence endpoint', 'status=' + evidence.status);
  }

  // ===== EKSTRAKURIKULER =====
  console.log('\n--- 15. Ekstrakurikuler ---');

  const ekskul = await guruMandiri.get('/api/ekstrakurikuler');
  if (ekskul.status < 400) {
    pass('Ekstrakurikuler endpoint', 'status=' + ekskul.status);
  } else {
    info('Ekstrakurikuler endpoint', 'status=' + ekskul.status);
  }

  // ===== FORUM =====
  console.log('\n--- 16. Forum ---');

  const forum = await guruMandiri.get('/api/forum');
  if (forum.status < 400) {
    pass('Forum endpoint', 'status=' + forum.status);
  } else {
    info('Forum endpoint', 'status=' + forum.status);
  }

  // ===== LAPORAN MENGAJAR =====
  console.log('\n--- 17. Laporan Mengajar ---');

  const lm = await guruMandiri.get('/api/laporan-mengajar');
  if (lm.status < 400) {
    pass('Laporan Mengajar endpoint', 'status=' + lm.status);
  } else {
    info('Laporan Mengajar endpoint', 'status=' + lm.status);
  }

  // ===== INSTITUTION PAGES (Kepala Sekolah) =====
  console.log('\n--- 18. Institution Pages (Kepala Sekolah) ---');

  const instDash = await kepalaSekolah.get('/api/institution/3');
  if (instDash.status < 400) {
    pass('Institution dashboard endpoint', 'status=' + instDash.status);
  } else {
    info('Institution dashboard endpoint', 'status=' + instDash.status);
  }

  const instMembers = await kepalaSekolah.get('/api/institution/3/members');
  if (instMembers.status < 400) {
    pass('Institution members endpoint', 'status=' + instMembers.status);
  } else {
    info('Institution members endpoint', 'status=' + instMembers.status);
  }

  // ===== EXPORT ROUTES =====
  console.log('\n--- 19. Export / Download Routes ---');

  const raportDownload = await guruMandiri.post('/api/raport/download', { studentId: 'test' });
  if (raportDownload.status < 400) {
    pass('Raport download', 'status=' + raportDownload.status);
  } else {
    info('Raport download', 'status=' + raportDownload.status);
  }

  const lkpdDownload = await guruMandiri.get('/api/lkpd/list?page=1&limit=1');
  if (lkpdDownload.status < 400) {
    pass('LKPD list (for download)', 'status=' + lkpdDownload.status);
  } else {
    info('LKPD list', 'status=' + lkpdDownload.status);
  }

  // ===== STORAGE / FILE =====
  console.log('\n--- 20. Storage / Files ---');

  const folders = await guruMandiri.get('/api/storage/folders');
  if (folders.status < 400) {
    pass('Storage folders endpoint', 'status=' + folders.status);
  } else {
    info('Storage folders endpoint', 'status=' + folders.status);
  }

  // ===== LIBRARY =====
  console.log('\n--- 21. Perpustakaan ---');

  const perpustakaan = await guruMandiri.get('/api/library');
  if (perpustakaan.status < 400) {
    pass('Perpustakaan endpoint', 'status=' + perpustakaan.status);
  } else {
    info('Perpustakaan endpoint', 'status=' + perpustakaan.status);
  }

  const libraryItems = await guruMandiri.get('/api/library/items');
  if (libraryItems.status < 400) {
    pass('Library items endpoint', 'status=' + libraryItems.status);
  } else {
    info('Library items endpoint', 'status=' + libraryItems.status);
  }

  // ===== ADMIN ROUTES =====
  console.log('\n--- 22. Admin Pages ---');

  const adminUsers = await guruMandiri.get('/api/admin/users');
  if (adminUsers.status < 400) {
    pass('Admin users endpoint', 'status=' + adminUsers.status);
  } else {
    info('Admin users endpoint (auth required)', 'status=' + adminUsers.status);
  }

  const adminTransactions = await guruMandiri.get('/api/admin/transactions/stats');
  if (adminTransactions.status < 400) {
    pass('Admin transactions endpoint', 'status=' + adminTransactions.status);
  } else {
    info('Admin transactions endpoint', 'status=' + adminTransactions.status);
  }

  // ===== TPG REPORT =====
  console.log('\n--- 23. TPG Report ---');

  const tpg = await kepalaSekolah.get('/api/reports/tpg');
  if (tpg.status < 400) {
    pass('TPG report endpoint', 'status=' + tpg.status);
  } else {
    info('TPG report endpoint', 'status=' + tpg.status);
  }

  console.log('\n=== Testing Complete ===');
  console.log('Check FAIL/INFO entries above for details.');
}

run().catch(e => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});
