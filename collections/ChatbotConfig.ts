import type { GlobalConfig } from "payload";

const ChatbotConfig: GlobalConfig = {
  slug: "chatbot-config",
  label: "Chatbot Config",
  admin: {
    group: "CMS",
  },
  fields: [
    {
      name: "isEnabled",
      type: "checkbox",
      label: "Aktifkan Chatbot",
      defaultValue: true,
    },
    {
      name: "welcomeMessage",
      type: "textarea",
      label: "Welcome Message",
      defaultValue:
        "Halo! Saya asisten AI GuruPRO 👋 Ada yang bisa saya bantu tentang fitur, harga, atau cara daftar GuruPRO AI?",
    },
    {
      name: "systemPrompt",
      type: "textarea",
      label: "System Prompt (AI Instructions)",
      defaultValue:
        "Kamu adalah CS assistant GuruPRO AI, platform administrasi keguruan berbasis AI untuk guru Indonesia. Bantu pengguna dengan informasi tentang fitur (RPP AI, absensi, jurnal, rapor, PKG), harga (Rp49.000/bulan), cara daftar, dan pertanyaan umum. Jawab dalam Bahasa Indonesia yang ramah dan profesional. Jika pertanyaan di luar produk GuruPRO, arahkan ke kontak CS manusia di wa.me/6281283960337.",
    },
    {
      name: "humanCSUrl",
      type: "text",
      label: "Human CS URL (WhatsApp)",
      defaultValue: "https://wa.me/6281283960337",
    },
  ],
};

export default ChatbotConfig;
