const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gurupro_db',
  password: 'nus4nt4r4',
  port: 5432,
});

async function main() {
  try {
    console.log('Cleaning up...');
    await pool.query("DELETE FROM institution_members_role WHERE parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
    await pool.query("DELETE FROM institution_members_assigned_mapel WHERE _parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
    await pool.query("DELETE FROM institution_members_assigned_kelas WHERE _parent_id IN (SELECT id FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com'))");
    await pool.query("DELETE FROM institution_members WHERE app_user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com') OR user_id IN (SELECT id FROM cms_users WHERE email = 'test-load-guru@example.com')");
    await pool.query("DELETE FROM cms_users WHERE email = 'test-load-guru@example.com'");
    await pool.query("DELETE FROM guru_administrasi WHERE user_id IN (SELECT id FROM users WHERE email = 'test-load-guru@example.com')");
    await pool.query("DELETE FROM institutions WHERE npsn = 'REG-LOAD'");
    await pool.query("DELETE FROM users WHERE email = 'test-load-guru@example.com'");

    console.log('Inserting user...');
    const userRes = await pool.query(
      `INSERT INTO users (email, whatsapp, nama_lengkap)
       VALUES ($1, $2, $3) RETURNING id`,
      ["test-load-guru@example.com", "08999999111", "Guru Load Test"]
    );
    const userId = userRes.rows[0].id;
    console.log('userId:', userId);

    console.log('Inserting institution...');
    const instRes = await pool.query(
      `INSERT INTO institutions (name, npsn, jenjang, naungan, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ["Test Load Inst", "REG-LOAD", "SMP", "Kemendikbud", "active"]
    );
    const instId = instRes.rows[0].id;
    console.log('instId:', instId);

    console.log('Inserting cms_user...');
    const cmsUserRes = await pool.query(
      `INSERT INTO cms_users (name, email, password)
       VALUES ('Guru Load', 'test-load-guru@example.com', 'pwd') RETURNING id`
    );
    const cmsUserId = cmsUserRes.rows[0].id;
    console.log('cmsUserId:', cmsUserId);

    console.log('Inserting member...');
    const memberRes = await pool.query(
      `INSERT INTO institution_members (user_id, app_user_id, institution_id, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [cmsUserId, userId, instId]
    );
    const memberId = memberRes.rows[0].id;
    console.log('memberId:', memberId);

    console.log('Inserting member role...');
    await pool.query(`INSERT INTO institution_members_role (parent_id, "order", value) VALUES ($1, 0, 'operator')`, [memberId]);
    console.log('SUCCESS!');

  } catch (err) {
    console.error('ERROR OCCURRED:', err);
  } finally {
    await pool.end();
  }
}

main();
