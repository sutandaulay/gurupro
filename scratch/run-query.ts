import { pool } from '../lib/db';

async function runQuery() {
  try {
    console.log('Running test GET dashboard handler...');
    // We try to run the query with a dummy teacherId
    const teacherId = '00000000-0000-0000-0000-000000000000';
    
    // Get user's email
    const userResult = await pool.query("SELECT id, email FROM users LIMIT 1");
    if (userResult.rows.length === 0) {
      console.log('No users found in database.');
      return;
    }
    const realTeacherId = userResult.rows[0].id;
    const email = userResult.rows[0].email;
    console.log('Using realTeacherId:', realTeacherId);
    console.log('Using email:', email);

    // Get cms_users ID
    const cmsUserResult = await pool.query("SELECT id FROM payload.cms_users WHERE email = $1", [email]);
    let assignments: any[] = [];
    if (cmsUserResult.rows.length > 0) {
      const cmsUserId = cmsUserResult.rows[0].id;
      console.log('Using cmsUserId:', cmsUserId);

      // Query assignments from payload schema
      const assignmentsResult = await pool.query(`
        SELECT 
          tia.id,
          tia.institution_id_id as "institutionId",
          i.name as "institutionName",
          i.location_latitude as "locationLatitude",
          i.location_longitude as "locationLongitude",
          i.attendance_settings_attendance_radius_meters as "attendanceRadiusMeters",
          i.attendance_settings_qr_code_enabled as "qrCodeEnabled",
          tia.subject_ids as "subjectIds",
          tia.weekly_schedule as "weeklySchedule",
          tia.status,
          tia.start_date as "startDate",
          tia.end_date as "endDate"
        FROM payload.teacher_institution_assignments tia
        LEFT JOIN payload.institutions i ON tia.institution_id_id = i.id
        WHERE tia.teacher_id_id = $1 AND tia.status = 'aktif'
      `, [cmsUserId]);
      
      assignments = assignmentsResult.rows || [];
    }

    const mapped = assignments.map(assignment => {
      const institutionLocation = {
        latitude: assignment.locationLatitude ? parseFloat(assignment.locationLatitude) : -6.2088,
        longitude: assignment.locationLongitude ? parseFloat(assignment.locationLongitude) : 106.8456,
      };
      const institutionSettings = {
        attendanceRadiusMeters: assignment.attendanceRadiusMeters ? parseFloat(assignment.attendanceRadiusMeters) : 100,
        qrCodeEnabled: !!assignment.qrCodeEnabled,
      };

      return {
        id: assignment.id,
        institutionId: assignment.institutionId,
        institutionName: assignment.institutionName,
        institutionLocation,
        institutionSettings,
        subjectIds: assignment.subjectIds,
        weeklySchedule: assignment.weeklySchedule,
        status: assignment.status,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      };
    });

    console.log('Test completed successfully!');
    console.log('Result:', mapped);
  } catch (err: any) {
    console.error('Error running raw SQL query:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

runQuery();
