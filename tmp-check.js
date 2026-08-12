const { Client } = require('pg');
const c = new Client({ user: 'postgres', password: 'nus4nt4r4', host: 'localhost', database: 'gurupro_db', port: 5432 });
async function run() {
  await c.connect();
  try {
    const r = await c.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance_summary' ORDER BY ordinal_position");
    console.log('attendance_summary columns:');
    r.rows.forEach(x => console.log(`  ${x.column_name}: ${x.data_type} (${x.udt_name})`));

    const r2 = await c.query("SELECT teacher_id, institution_id, date FROM attendance_summary LIMIT 3");
    console.log('\nattendance_summary sample:');
    r2.rows.forEach(x => console.log(`  teacher_id=${x.teacher_id} (${typeof x.teacher_id}) institution_id=${x.institution_id} date=${x.date}`));

    const r3 = await c.query("SELECT COUNT(*) as total, COUNT(DISTINCT teacher_id) as unique_teachers FROM attendance_summary");
    console.log(`\nTotal rows: ${r3.rows[0].total}, Unique teachers: ${r3.rows[0].unique_teachers}`);

    const r4 = await c.query("SELECT im.app_user_id, im.user_id, im.institution_id, imr.value as role FROM public.institution_members im JOIN public.institution_members_role imr ON imr.parent_id = im.id WHERE im.status='active' LIMIT 5");
    console.log('\nMembers sample (first 5):');
    r4.rows.forEach(x => console.log(`  app_user_id=${x.app_user_id} user_id=${x.user_id} inst=${x.institution_id} role=${x.role}`));
  } finally {
    await c.end();
  }
}
run().catch(e => console.error(e.message));
