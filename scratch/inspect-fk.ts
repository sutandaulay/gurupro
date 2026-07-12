import { query } from "../lib/db";

async function main() {
  try {
    // 1. List all columns in payload.bahan_ajar
    const columnsRes = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'payload' AND table_name = 'bahan_ajar';
    `);
    console.log("Columns in payload.bahan_ajar:", columnsRes.rows);

    // 2. List all tables that have foreign keys referencing payload.bahan_ajar
    const fkRes = await query(`
      SELECT
        tc.table_schema, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'bahan_ajar';
    `);
    console.log("Foreign keys referencing payload.bahan_ajar:", fkRes.rows);

    // 3. Check if payload_locked_documents_rels table exists and its columns
    const lockedRes = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'payload' AND table_name = 'payload_locked_documents_rels';
    `);
    console.log("Columns in payload_locked_documents_rels:", lockedRes.rows);

  } catch (error) {
    console.error("Error inspecting DB:", error);
  }
  process.exit(0);
}

main();
