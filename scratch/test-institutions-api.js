const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gurupro_db',
  password: 'nus4nt4r4',
  port: 5432,
});

async function main() {
  const userId = '67d29e3e-7c80-4e4a-8c33-b7f33b07e2ed';
  try {
    console.log('1. Fetching user...');
    const userResult = await pool.query("SELECT email, nama_lengkap FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userEmail = userResult.rows[0].email;
    const userFullName = userResult.rows[0].nama_lengkap || 'Guru';
    console.log(`User: ${userFullName} <${userEmail}>`);

    console.log('2. Ensuring cms_users entry...');
    let cmsUserId = null;
    const cmsUserResult = await pool.query("SELECT id FROM payload.cms_users WHERE email = $1", [userEmail]);
    if (cmsUserResult.rows.length > 0) {
      cmsUserId = cmsUserResult.rows[0].id;
    } else {
      const newCmsUser = await pool.query(
        `INSERT INTO payload.cms_users (name, email, password, role, salt, hash, updated_at, created_at)
         VALUES ($1, $2, '', 'admin', '', '', NOW(), NOW())
         RETURNING id`,
        [userFullName, userEmail]
      );
      cmsUserId = newCmsUser.rows[0].id;
    }
    console.log(`CMS User ID: ${cmsUserId}`);

    console.log('3. Fetching user schools...');
    const schoolsResult = await pool.query("SELECT id, nama_sekolah, npsn, alamat FROM schools WHERE user_id = $1", [userId]);
    console.log(`Schools count: ${schoolsResult.rows.length}`);

    for (const school of schoolsResult.rows) {
      const npsn = school.npsn || `MOCK_${school.id.replace(/-/g, '').slice(0, 10)}`;
      console.log(`Syncing school: ${school.nama_sekolah} (NPSN: ${npsn})...`);
      
      let instId = null;
      const instCheck = await pool.query(
        "SELECT id FROM payload.institutions WHERE npsn = $1 OR name = $2 LIMIT 1",
        [npsn, school.nama_sekolah]
      );
      
      if (instCheck.rows.length > 0) {
        instId = instCheck.rows[0].id;
        console.log(`Existing Institution ID: ${instId}`);
      } else {
        const newInst = await pool.query(
          `INSERT INTO payload.institutions (
            name, npsn, jenjang, naungan, subscription_tier, 
            academic_year_active, approval_layer_config, status, 
            location_latitude, location_longitude,
            attendance_settings_attendance_radius_meters, attendance_settings_qr_code_enabled,
            created_at, updated_at
           )
           VALUES ($1, $2, 'SMA', 'Kemendikbud', 'basic', '2026/2027', 'single', 'active', -6.2088, 106.8456, 10000000, false, NOW(), NOW())
           RETURNING id`,
          [school.nama_sekolah, npsn]
        );
        instId = newInst.rows[0].id;
        console.log(`Created Institution ID: ${instId}`);
      }

      // Check if member
      const memberCheck = await pool.query(
        "SELECT id FROM payload.institution_members WHERE app_user_id = $1 AND institution_id = $2 LIMIT 1",
        [userId, instId]
      );
      
      if (memberCheck.rows.length === 0) {
        const newMember = await pool.query(
          `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
           RETURNING id`,
          [cmsUserId, userId, instId]
        );
        const memberId = newMember.rows[0].id;
        
        await pool.query(
          `INSERT INTO payload.institution_members_role ("order", parent_id, value)
           VALUES (1, $1, 'guru')
           ON CONFLICT DO NOTHING`,
          [memberId]
        );
        console.log(`Added membership: ${memberId}`);
      } else {
        console.log(`Already a member of institution: ${memberCheck.rows[0].id}`);
      }
    }

    console.log('4. Querying connected institutions...');
    const connectedInsts = await pool.query(
      `SELECT i.id, i.name, i.location_latitude as latitude, i.location_longitude as longitude, 
              i.attendance_settings_attendance_radius_meters as radius_meters, 
              i.attendance_settings_qr_code_enabled as qr_enabled
       FROM payload.institutions i
       JOIN payload.institution_members im ON im.institution_id = i.id
       WHERE im.app_user_id = $1 AND im.status = 'active'`,
      [userId]
    );
    console.log('Result:', JSON.stringify(connectedInsts.rows, null, 2));

  } catch (err) {
    console.error('ERROR ENCOUNTERED:', err);
  } finally {
    await pool.end();
  }
}

main();
