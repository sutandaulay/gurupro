import ChatbotWidget from "@/components/landing/ChatbotWidget";
import { query } from "@/lib/db";

export default async function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let welcomeMessage: string | undefined;
  let isEnabled = false;
  let humanCSUrl: string | undefined;

  // Get chatbot config from database cache (fast)
  try {
    const cacheRes = await query(
      "SELECT key, value FROM system_settings WHERE key = 'landing_chatbot'"
    );
    if (cacheRes.rows.length > 0) {
      try {
        const val = cacheRes.rows[0].value;
        const cached = typeof val === "string" ? JSON.parse(val) : val;
        isEnabled = cached.isEnabled === true;
        welcomeMessage = cached.welcomeMessage;
        humanCSUrl = cached.humanCSUrl;
      } catch {
        // Ignore parse errors
      }
    }
  } catch {
    // Ignore database errors
  }

  return (
    <>
      {children}
      {isEnabled && <ChatbotWidget welcomeMessage={welcomeMessage} humanCSUrl={humanCSUrl} />}
    </>
  );
}
