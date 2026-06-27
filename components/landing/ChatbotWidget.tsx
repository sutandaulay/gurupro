"use client";

import { useState, useRef, useEffect } from "react";
import { IconRobot, IconX, IconSend, IconSparklesFilled } from "@tabler/icons-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatbotWidgetProps {
  apiEndpoint?: string;
  welcomeMessage?: string;
  agentName?: string;
}

export default function ChatbotWidget({
  apiEndpoint = "/api/chatbot",
  welcomeMessage = "Halo! Saya asisten AI GuruPRO 👋 Ada yang bisa saya bantu tentang fitur, harga, atau cara daftar GuruPRO AI?",
  agentName = "GuruPRO AI Assistant",
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Maaf, terjadi gangguan koneksi. Silakan coba sesaat lagi.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, terjadi kesalahan saat menghubungi server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 bg-gradient-to-br from-primary-600 to-purple-600 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-primary-400/40 hover:scale-105 transition-all duration-300 focus:outline-none ${
          !isOpen ? "animate-pulse" : ""
        }`}
        aria-label={isOpen ? "Tutup chat" : "Buka chat"}
      >
        {isOpen ? (
          <IconX size={24} />
        ) : (
          <div className="relative">
            <IconRobot size={26} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-white" />
          </div>
        )}
      </button>

      {/* Label */}
      {!isOpen && (
        <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-white text-neutral-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-neutral-200 whitespace-nowrap animate-fade-in">
          Tanya GuruPRO AI
        </span>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-160px)] bg-white border border-neutral-200 shadow-2xl rounded-3xl overflow-hidden flex flex-col animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white p-4 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <IconSparklesFilled size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold leading-tight">{agentName}</h4>
              <p className="text-[10px] text-primary-200 font-medium">
                Balas dalam hitungan detik
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary-600 text-white rounded-tr-none"
                      : "bg-white text-neutral-800 border border-neutral-200 rounded-tl-none shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-3 border-t border-neutral-200 bg-white flex gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pesan..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-2xl text-sm focus:border-primary-500 outline-none bg-neutral-50 text-neutral-800 placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition disabled:opacity-50 shrink-0"
            >
              <IconSend size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
