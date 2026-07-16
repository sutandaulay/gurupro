import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function migrate() {
  console.log('🔄 Running migration: Add face_descriptor column');

  try {
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user_face_enrollment' AND column_name = 'face_descriptor'
    `);

    if (checkResult.rows.length === 0) {
      console.log('Adding face_descriptor column...');
      await pool.query(`
        ALTER TABLE user_face_enrollment
        ADD COLUMN face_descriptor JSONB
      `);
      console.log('✅ Added face_descriptor column');
    } else {
      console.log('✅ face_descriptor column already exists');
    }

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
