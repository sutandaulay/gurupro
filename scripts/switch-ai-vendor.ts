import { query } from '../lib/db';

async function switchToGemini() {
  try {
    const result = await query("SELECT value FROM system_settings WHERE key = 'ai_config'");

    if (result.rows.length === 0) {
      console.log('No ai_config found in database');
      return;
    }

    // Value can be object or string depending on how it was stored
    let config = result.rows[0].value;
    if (typeof config === 'string') {
      config = JSON.parse(config);
    }

    console.log('Current vendor:', config.default_vendor);

    // Switch to Gemini
    config.default_vendor = 'gemini';

    await query(
      "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'ai_config'",
      [JSON.stringify(config)]
    );

    console.log('Successfully switched to Gemini!');
    console.log('New config:', JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}

switchToGemini();
