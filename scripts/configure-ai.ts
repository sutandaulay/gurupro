/**
 * Configure AI Vendor to Gemini
 * Run: npx tsx scripts/configure-ai.ts
 */

import { pool } from "../lib/db";

async function configureAI() {
  console.log('=== CONFIGURE AI VENDOR ===\n');

  // Gemini API Key from .env.local
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const aiConfig = {
    default_vendor: "gemini",
    gemini: {
      api_key: GEMINI_API_KEY,
      model_name: "gemini-2.0-flash"
    },
    openai: {
      api_key: "",
      model_name: "gpt-4o-mini"
    },
    claude: {
      api_key: "",
      model_name: "claude-3-5-sonnet-20241022"
    },
    deepseek: {
      api_key: "",
      model_name: "deepseek-chat"
    }
  };

  try {
    // Check current config
    const current = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_config'");
    if (current.rows.length > 0) {
      const val = typeof current.rows[0].value === 'string'
        ? JSON.parse(current.rows[0].value)
        : current.rows[0].value;
      console.log('Current config:');
      console.log(`  default_vendor: ${val.default_vendor}`);
      console.log(`  gemini api_key: ${val.gemini?.api_key ? 'SET' : 'NOT SET'}`);
    }

    // Update to Gemini
    console.log('\nUpdating to Gemini...');
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['ai_config', JSON.stringify(aiConfig)]
    );

    console.log('✅ AI vendor configured to Gemini');
    console.log(`   Model: ${aiConfig.gemini.model_name}`);
    console.log(`   API Key: ${GEMINI_API_KEY.substring(0, 20)}...`);

    // Verify
    const verify = await pool.query("SELECT value FROM system_settings WHERE key = 'ai_config'");
    const val = typeof verify.rows[0].value === 'string'
      ? JSON.parse(verify.rows[0].value)
      : verify.rows[0].value;
    console.log('\nVerification:');
    console.log(`  default_vendor: ${val.default_vendor}`);
    console.log(`  gemini api_key: ${val.gemini?.api_key ? '✅ SET' : '❌ MISSING'}`);

  } catch (e) {
    console.error('Failed to configure AI:', e);
  }

  await pool.end();
}

configureAI().catch((e) => {
  console.error(e);
  process.exit(1);
});
