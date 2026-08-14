import { NextResponse } from 'next/server';
import { query as pgQuery } from '@/lib/db';
import { cookies } from 'next/headers';
import { parseSessionCookie } from '@/lib/session-sign';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = parseSessionCookie(cookieStore.get('gurupro_session')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id;

    // 1. Get user's email and details
    const userResult = await pgQuery("SELECT email, nama_lengkap FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userEmail = userResult.rows[0].email;
    const userFullName = userResult.rows[0].nama_lengkap || 'Guru';

    // 2. Ensure cms_users entry exists for the user
    let cmsUserId = null;
    const cmsUserResult = await pgQuery("SELECT id FROM payload.cms_users WHERE email = $1", [userEmail]);
    if (cmsUserResult.rows.length > 0) {
      cmsUserId = cmsUserResult.rows[0].id;
    } else {
      const newCmsUser = await pgQuery(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at, created_at, updated_at)
         VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW(), NOW(), NOW())
         RETURNING id`,
        [userFullName, userEmail]
      );
      cmsUserId = newCmsUser.rows[0].id;
    }

    // 3. Get all schools registered by the user
    const schoolsResult = await pgQuery("SELECT id, nama_sekolah, npsn, alamat FROM schools WHERE user_id = $1", [userId]);
    
    for (const school of schoolsResult.rows) {
      const npsn = school.npsn || `MOCK_${school.id.replace(/-/g, '').slice(0, 10)}`;
      
      // Check if institution already exists by NPSN or Name
      let instId = null;
      const instCheck = await pgQuery(
        "SELECT id FROM payload.institutions WHERE npsn = $1 OR name = $2 LIMIT 1",
        [npsn, school.nama_sekolah]
      );
      
      if (instCheck.rows.length > 0) {
        instId = instCheck.rows[0].id;
      } else {
        // Create new institution
        const newInst = await pgQuery(
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
      }

      // Ensure user is institution_member
      const memberCheck = await pgQuery(
        "SELECT id FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2 LIMIT 1",
        [userId, instId]
      );
      
      if (memberCheck.rows.length === 0) {
        const newMember = await pgQuery(
          `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
           RETURNING id`,
          [cmsUserId, userId, instId]
        );
        
        const memberId = newMember.rows[0].id;
        
        await pgQuery(
          `INSERT INTO payload.institution_members_role ("order", parent_id, value)
           VALUES (1, $1, 'guru')
           ON CONFLICT DO NOTHING`,
          [memberId]
        );
      }
    }

    // 4. Query all active institutions connected to the user
    const connectedInsts = await pgQuery(
      `SELECT i.id, i.name, i.location_latitude as latitude, i.location_longitude as longitude, 
              i.attendance_settings_attendance_radius_meters as radius_meters, 
              i.attendance_settings_qr_code_enabled as qr_enabled
       FROM payload.institutions i
       JOIN public.institution_members im ON im.institution_id = i.id
       WHERE im.app_user_id = $1 AND im.status = 'active'`,
      [userId]
    );

    const formatted = connectedInsts.rows.map((inst: any) => ({
      id: inst.id.toString(),
      name: inst.name,
      location: {
        latitude: inst.latitude ? parseFloat(inst.latitude) : -6.2088,
        longitude: inst.longitude ? parseFloat(inst.longitude) : 106.8456
      },
      attendanceSettings: {
        attendanceRadiusMeters: inst.radius_meters ? parseInt(inst.radius_meters) : 100,
        qrCodeEnabled: !!inst.qr_enabled
      }
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching institutions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}