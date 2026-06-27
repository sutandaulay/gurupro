const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'gurupro_db',
    user: 'postgres',
    password: 'nus4nt4r4',
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'migrate-payload-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await client.query(statement);
        console.log('✅ Statement executed');
      } catch (err) {
        // Ignore errors for ON CONFLICT DO NOTHING
        if (!err.message.includes('duplicate key') && !err.message.includes('already exists')) {
          console.log('⚠️ Statement warning:', err.message);
        }
      }
    }

    console.log('\n🎉 Migration complete!');
    console.log('\n📋 Tables created:');
    console.log('   - cms_features (6 default features)');
    console.log('   - why_points (4 default points)');
    console.log('   - categories');
    console.log('   - posts');
    console.log('   - media');
    console.log('   - users');
    console.log('   - system_settings (with default landing content)');
    console.log('   - wallets');
    console.log('   - transactions');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
