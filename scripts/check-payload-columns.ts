/**
 * Check Payload Column Names
 * Run: npx tsx scripts/check-payload-columns.ts
 */

import { pool } from "../lib/db";

async function checkColumns() {
  const tables = ['cms_features', 'why_points', 'landing_page', 'footer_content', 'chatbot_config'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    try {
      const cols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'payload'
        AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      if (cols.rows.length === 0) {
        console.log('  Table not found');
      } else {
        cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await pool.end();
}

checkColumns().catch(console.error);
