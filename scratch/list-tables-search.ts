import { query } from "../lib/db";

async function main() {
  try {
    const schemas = await query(`
      SELECT schema_name 
      FROM information_schema.schemata;
    `);
    console.log("All schemas:", schemas.rows.map(r => r.schema_name));

    const tables = await query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    console.log("All tables:", tables.rows);
  } catch (error) {
    console.error("Error listing tables:", error);
  }
  process.exit(0);
}

main();
