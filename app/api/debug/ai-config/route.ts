import { getAIConfig } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = await getAIConfig();

    // Mask API keys for security
    const safeConfig = {
      default_vendor: config.default_vendor,
      gemini: {
        api_key_set: !!config.gemini.api_key,
        model_name: config.gemini.model_name,
      },
      openai: {
        api_key_set: !!config.openai.api_key,
        model_name: config.openai.model_name,
      },
      claude: {
        api_key_set: !!config.claude.api_key,
        model_name: config.claude.model_name,
      },
      deepseek: {
        api_key_set: !!config.deepseek.api_key,
        model_name: config.deepseek.model_name,
      },
    };

    return NextResponse.json({
      success: true,
      config: safeConfig,
      message: config.default_vendor === "mock"
        ? "AI masih dalam mode MOCK. Silakan konfigurasi API key di Admin Panel."
        : `AI vendor aktif: ${config.default_vendor}`
    });
  } catch (error: any) {
    console.error("AI Config error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
