"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconSend,
  IconSparkles,
  IconUser,
  IconTrash,
  IconX,
  IconArrowLeft,
  IconBook,
  IconFileText,
  IconMessage,
  IconChartBar,
  IconUsers,
  IconPhone,
  IconWallet,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useTokenError, parseTokenError } from "@/app/hooks/useTokenError";

  const PoinHabisModal = dynamic(() => import("@/app/components/ui/PoinHabisModal"), { ssr: false });

interface ChatAdministrasiProps {
  onBack?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: {
    type: string;
    data: any;
  };
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <IconBook size={16} />,
    label: "Buat Jurnal",
    prompt: "Buatkan jurnal mengajar untuk hari ini",
    color: "bg-emerald-500",
  },
  {
    icon: <IconFileText size={16} />,
    label: "Buat RPP",
    prompt: "Buatkan RPP untuk mata pelajaran",
    color: "bg-blue-500",
  },
  {
    icon: <IconMessage size={16} />,
    label: "Buat Soal",
    prompt: "Buatkan 10 soal HOTS untuk",
    color: "bg-purple-500",
  },
  {
    icon: <IconChartBar size={16} />,
    label: "Analisis Kelas",
    prompt: "Analisis nilai kelas",
    color: "bg-amber-500",
  },
  {
    icon: <IconPhone size={16} />,
    label: "Pesan WA",
    prompt: "Buatkan pesan WhatsApp untuk orang tua tentang",
    color: "bg-green-500",
  },
  {
    icon: <IconUsers size={16} />,
    label: "Rekomendasi",
    prompt: "Beri rekomendasi pembelajaran untuk",
    color: "bg-rose-500",
  },
  {
    icon: <IconWallet size={16} />,
    label: "Catat Transaksi",
    prompt: "Catat transaksi: ",
    color: "bg-amber-600",
  },
];

export default function ChatAdministrasi({ onBack }: ChatAdministrasiProps) {
  const { showTokenModal, shortfall, handleTokenError, closeModal, openTopUpModal } = useTokenError();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Selamat datang! 👋

Saya adalah asisten AI GuruPRO yang siap membantu Anda dalam administrasi sekolah.

**Yang bisa saya bantu:**
- 📓 Membuat jurnal mengajar
- 📋 Membuat RPP/Modul Ajar
- 📝 Membuat soal (PG, Essay, HOTS)
- 📊 Menganalisis nilai siswa
- 📱 Membuat pesan untuk komunikasi dengan orang tua
- 📄 Membuat deskripsi rapor
- 💰 Catat transaksi keuangan (pemasukan/pengeluaran)

Silakan ketik pertanyaan Anda atau gunakan aksi cepat di bawah!`,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [financeEditingId, setFinanceEditingId] = useState<string | null>(null);
  const [financeDraft, setFinanceDraft] = useState<{ text: string }>({ text: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setError(null);
    setIsLoading(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if token error
        if (result.reason === "token_habis" || result.reason === "subscription_expired") {
          handleTokenError(parseTokenError(result));
        } else {
          throw new Error(result.error || "Gagal mendapatkan respons");
        }
      }

      // Update session ID
      if (result.session_id) {
        setSessionId(result.session_id);
      }

      // Add AI response
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        action: result.action,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err.message);
      // Remove the user message if error
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const handleFinanceSave = async (msgId: string, rawText: string) => {
    try {
      const res = await apiFetch('/api/administrasi/parse-keuangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses transaksi');

      const financeRes = await apiFetch('/api/administrasi?tipe=keuangan');
      let docId = '';
      let existingTransactions: any[] = [];
      if (financeRes.ok) {
        const financeData = await financeRes.json();
        if (Array.isArray(financeData) && financeData.length > 0) {
          docId = financeData[0].id;
          const konten = financeData[0].konten;
          existingTransactions = Array.isArray(konten?.transactions) ? konten.transactions : [];
        }
      }

      const newTx = {
        id: `tx-${Date.now()}`,
        keterangan: data.data.keterangan,
        jumlah: data.data.jumlah,
        tipe: data.data.tipe,
        kategori: data.data.kategori,
        tanggal: data.data.tanggal,
      };

      const updatedTransactions = [...existingTransactions, newTx];

      const saveRes = await apiFetch('/api/administrasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId || undefined,
          judul_dokumen: 'Catatan Keuangan',
          tipe_dokumen: 'keuangan',
          konten: {
            transactions: updatedTransactions,
            savings: [],
            investments: [],
          },
          tanggal_kegiatan: data.data.tanggal,
        }),
      });

      if (!saveRes.ok) {
        const saveData = await saveRes.json();
        throw new Error(saveData.error || 'Gagal menyimpan transaksi');
      }

      const savedText = `Tercatat: ${data.data.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} ${data.data.keterangan} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(data.data.jumlah)} pada ${new Date(data.data.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;

      setMessages((prev) => prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            content: savedText,
            action: undefined,
          };
        }
        return m;
      }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFinanceEdit = (msgId: string) => {
    setFinanceEditingId(msgId);
    const msg = messages.find((m) => m.id === msgId);
    if (msg?.action?.data?.text) {
      setFinanceDraft({ text: msg.action.data.text });
    }
  };

  const handleFinanceEditSave = async (msgId: string) => {
    if (!financeDraft.text.trim()) return;
    await handleFinanceSave(msgId, financeDraft.text.trim());
    setFinanceEditingId(null);
    setFinanceDraft({ text: '' });
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId("");
    setError(null);
    // Reset to welcome
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Selamat datang! 👋

Saya adalah asisten AI GuruPRO yang siap membantu Anda dalam administrasi sekolah.

**Yang bisa saya bantu:**
- 📓 Membuat jurnal mengajar
- 📋 Membuat RPP/Modul Ajar
- 📝 Membuat soal (PG, Essay, HOTS)
- 📊 Menganalisis nilai siswa
- 📱 Membuat pesan untuk komunikasi dengan orang tua
- 📄 Membuat deskripsi rapor

Silakan ketik pertanyaan Anda atau gunakan aksi cepat di bawah!`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
    <div className="flex flex-col h-full bg-slate-50 rounded-none sm:rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-2 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="text-white/80 hover:text-white p-1 -ml-1">
                <IconArrowLeft size={20} />
              </button>
            )}
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <IconSparkles className="text-white" size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">AI Chat</h3>
              <p className="text-[10px] text-white/80">Tanyakan apa saja</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearChat}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              title="Hapus Percakapan"
            >
              <IconTrash size={16} />
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition sm:hidden"
                title="Tutup"
              >
                <IconX size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                message.role === "user"
                  ? "bg-indigo-500 text-white rounded-2xl rounded-br-md"
                  : "bg-white shadow-sm rounded-2xl rounded-bl-md"
              }`}
            >
              <div className="p-3">
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-indigo-500">
                    <IconSparkles size={12} />
                    <span>AI Assistant</span>
                  </div>
                )}
                <div
                  className={`text-sm whitespace-pre-wrap ${
                    message.role === "user" ? "text-white" : "text-slate-700"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {message.content}
                </div>

                {message.action?.type === 'finance_parse' && (
                  <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-indigo-700">Konfirmasi Catat Transaksi</p>
                    <p className="text-xs text-slate-700">Teks: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{message.action.data.text}</span></p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFinanceSave(message.id, message.action!.data.text)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => handleFinanceEdit(message.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Edit
                      </button>
                  </div>
                  {financeEditingId === message.id && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-lg p-2 space-y-2">
                      <textarea
                        value={financeDraft.text}
                        onChange={(e) => setFinanceDraft({ text: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-indigo-400 outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleFinanceEditSave(message.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer">Simpan Perubahan</button>
                        <button onClick={() => { setFinanceEditingId(null); setFinanceDraft({ text: '' }); }} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer">Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
              <div
                className={`px-3 pb-2 text-[10px] ${
                  message.role === "user" ? "text-white/60" : "text-slate-400"
                }`}
              >
                {message.timestamp.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm rounded-2xl rounded-bl-md p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs">AI sedang mengetik...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-xs">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-2 sm:px-4 py-2 bg-white border-t border-slate-100">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleQuickAction(action.prompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${action.color} text-white rounded-full text-xs font-medium whitespace-nowrap hover:opacity-90 transition shrink-0`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-2 sm:p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pertanyaan Anda..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLoading}
            className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
              inputMessage.trim() && !isLoading
                ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <IconSend size={18} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          Tekan Enter untuk mengirim • Shift+Enter untuk baris baru
        </p>
      </div>
    </div>

    {/* Token Habis Modal */}
    <PoinHabisModal
      open={showTokenModal}
      shortfall={shortfall}
      onClose={closeModal}
      onBuyTopUp={openTopUpModal}
      onUpgrade={() => window.location.href = '/profile?tab=billing'}
    />
    </>
  );
}