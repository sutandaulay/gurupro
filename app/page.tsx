"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cmsConfig, setCmsConfig] = useState<any>(null);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [brandingConfig, setBrandingConfig] = useState<{
    app_name: string;
    app_logo: string;
    accent_color: string;
    contact_email: string;
    contact_whatsapp: string;
  }>({
    app_name: "GuruPRO",
    app_logo: "",
    accent_color: "#4f46e5",
    contact_email: "support@gurupro.id",
    contact_whatsapp: ""
  });

  // Chatbot widget states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([
    { role: "assistant", content: "Halo! Saya adalah Asisten AI GuruPRO. Ada yang bisa saya bantu terkait platform, paket harga, atau fitur kami?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = { role: "user", content: chatInput.trim() };
    const updatedMsgs = [...chatMessages, userMsg];
    setChatMessages(updatedMsgs);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMsgs })
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages([...updatedMsgs, { role: "assistant", content: data.reply }]);
      } else {
        setChatMessages([...updatedMsgs, { role: "assistant", content: "Maaf, terjadi gangguan koneksi. Silakan coba sesaat lagi." }]);
      }
    } catch (err) {
      setChatMessages([...updatedMsgs, { role: "assistant", content: "Maaf, terjadi kesalahan saat menghubungi server." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    // Fetch branding config
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setBrandingConfig(data);
          setChatMessages([
            { role: "assistant", content: `Halo! Saya adalah Asisten AI ${data.app_name || "GuruPRO"}. Ada yang bisa saya bantu terkait platform, paket harga, atau fitur kami?` }
          ]);
        }
      })
      .catch((err) => console.error("Gagal memuat branding:", err));

    // Check login
    fetch("/api/user/profile")
      .then((res) => {
        if (res.ok) setIsLoggedIn(true);
      })
      .catch(() => {});

    // Fetch CMS Landing Page configuration
    fetch("/api/admin/cms")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setCmsConfig(data);
        }
      })
      .catch((err) => console.error("Gagal memuat CMS:", err));

    // Fetch pricing configuration
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setPricingConfig(data);
        }
      })
      .catch((err) => console.error("Gagal memuat pricing:", err));

    // Get referral code from URL query parameter
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get("ref");
      if (ref) {
        setRefCode(ref.toUpperCase());
      }
    }
  }, []);

  // Default values for Fallback UI
  const badgeText = cmsConfig?.hero_badge || "✨ Next-Gen AI Edu-Platform untuk Guru Indonesia";
  const heroTitle = cmsConfig?.hero_title || "Pangkas Waktu Administrasi,\nBuat Soal Ujian Otomatis dengan AI";
  const heroSubtitle = cmsConfig?.hero_subtitle || "GuruPRO membantu pendidik merumuskan administrasi kelas dan butir soal ujian berkualitas tinggi berbasis Taksonomi Bloom (HOTS/LOTS) dalam hitungan detik.";
  const features = cmsConfig?.features || [
    { icon: "🧠", title: "Generator Soal Komprehensif", desc: "Cukup masukkan topik, AI akan menyusun soal Pilihan Ganda (PG), PG Kompleks, Isian Singkat, Uraian, hingga Menjodohkan secara akurat." },
    { icon: "📊", title: "Standar Taksonomi Bloom", desc: "Sesuaikan level kognitif asesmen murid Anda dari tingkat rendah (LOTS C1-C3) hingga penalaran kritis tingkat tinggi (HOTS C4-C6)." },
    { icon: "🖨️", title: "Siap Cetak & Ekspor", desc: "Dilengkapi dengan format Kop Surat Ujian resmi sekolah otomatis. Siap dicetak langsung ke printer atau disalin ke dokumen Microsoft Word Anda." }
  ];
  const faq = cmsConfig?.faq || [
    { question: "Bagaimana cara kerja perhitungan Token kuota?", answer: "Setiap kali Anda menekan tombol generate paket butir soal baru, sistem akan memotong 1 Token dari sisa batas limit token Anda. Token ini akan otomatis diperbarui setiap masa tagihan bulanan berjalan." },
    { question: "Apakah metode pembayaran mendukung e-Wallet lokal?", answer: "Ya! Pembayaran SaaS GuruPRO sangat fleksibel terintegrasi menggunakan QRIS, GoPay, OVO, Dana, serta transfer Virtual Account bank terkemuka di Indonesia." }
  ];
  const referralTerms = cmsConfig?.referral_terms || "Dapatkan cashback senilai Rp10.000 tunai dan +20 Token kuota untuk setiap guru yang mendaftar dan berlangganan menggunakan kode referral unik Anda! Teman Anda juga akan mendapatkan bonus +10 Token saat mendaftar.";

  const pricing = pricingConfig || {
    free: { price: 0, tokens: 10, duration_days: 30 },
    three_month: { price: 120000, tokens: 500, duration_days: 90 },
    six_month: { price: 220000, tokens: 1100, duration_days: 180 },
    one_year: { price: 400000, tokens: 2500, duration_days: 365 }
  };

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "decimal",
      minimumFractionDigits: 0
    }).format(p);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Dynamic Accent Color Stylesheet */}
      {brandingConfig?.accent_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary-accent: ${brandingConfig.accent_color};
          }
          .text-indigo-600 { color: ${brandingConfig.accent_color} !important; }
          .bg-indigo-600 { background-color: ${brandingConfig.accent_color} !important; }
          .hover\\:bg-indigo-700:hover { background-color: ${brandingConfig.accent_color} !important; }
          .hover\\:text-indigo-600:hover { color: ${brandingConfig.accent_color} !important; }
          .border-indigo-600 { border-color: ${brandingConfig.accent_color} !important; }
          .shadow-indigo-200 { shadow-color: ${brandingConfig.accent_color}30 !important; }
          .selection\\:bg-indigo-500::selection { background-color: ${brandingConfig.accent_color} !important; }
        ` }} />
      )}

      {/* 0. REFERRAL FLOATING ALERT BAR */}
      {refCode && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold py-2.5 px-4 text-center sticky top-0 z-50 flex items-center justify-center gap-2 shadow-md animate-fadeIn no-print">
          <span>🎁</span>
          <span>Anda diundang oleh teman! Daftar sekarang menggunakan kode referral <strong>{refCode}</strong> untuk mendapatkan bonus <strong>+10 Token kuota gratis</strong>!</span>
          <button 
            type="button" 
            onClick={() => setRefCode(null)}
            className="ml-4 hover:text-slate-100 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md transition"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1. NAVBAR */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200/80 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {brandingConfig?.app_logo ? (
              <img src={brandingConfig.app_logo} alt={brandingConfig.app_name} className="h-9 object-contain" />
            ) : (
              <>
                <span className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-md shadow-indigo-200">
                  {brandingConfig?.app_name ? brandingConfig.app_name[0].toUpperCase() : "G"}
                </span>
                <h1 className="text-2xl font-black tracking-tight text-indigo-600">
                  {brandingConfig?.app_name || "GuruPRO"}
                </h1>
              </>
            )}
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#fitur" className="hover:text-indigo-600 transition">Fitur Utama</a>
            <a href="#harga" className="hover:text-indigo-600 transition">Harga &amp; Langganan</a>
            <a href="#referral" className="hover:text-indigo-600 transition">Program Referral</a>
            <a href="#faq" className="hover:text-indigo-600 transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-sm shadow-indigo-100 transition duration-200">
                Buka Dashboard
              </Link>
            ) : (
              <>
                <Link href={refCode ? `/login?ref=${refCode}` : "/login"} className="px-4 py-2.5 text-sm font-bold text-slate-700 hover:text-indigo-600 transition">
                  Masuk
                </Link>
                <Link href={refCode ? `/login?ref=${refCode}` : "/login?mode=register"} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-sm shadow-indigo-100 transition duration-200">
                  Daftar Sekarang
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-36 pb-20 md:pt-48 md:pb-28 overflow-hidden bg-gradient-to-b from-indigo-50/40 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center flex flex-col items-center relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full mb-6 border border-indigo-100">
            {badgeText}
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 max-w-4xl leading-[1.15] md:leading-tight whitespace-pre-line">
            {heroTitle}
          </h2>
          <p className="mt-6 text-slate-500 text-base md:text-lg max-w-2xl leading-relaxed">
            {heroSubtitle}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
            <Link 
              href={isLoggedIn ? "/dashboard" : (refCode ? `/login?ref=${refCode}` : "/login?mode=register")} 
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 transition duration-200 text-center"
            >
              {isLoggedIn ? "Masuk Dashboard" : "Coba Mulai Gratis"}
            </Link>
            <a href="#harga" className="px-8 py-4 bg-white border border-slate-200 text-slate-600 font-bold text-base rounded-2xl hover:bg-slate-50 transition duration-200 text-center shadow-sm">
              Lihat Paket Berlangganan
            </a>
          </div>

          {/* Mini Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 border border-slate-200/60 bg-white p-6 md:p-8 rounded-3xl shadow-sm max-w-4xl w-full">
            <div>
              <p className="text-2xl md:text-3xl font-black text-indigo-600">10x</p>
              <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Lebih Cepat Buat Soal</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-purple-600">99%</p>
              <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Akurasi Kurikulum</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-emerald-600">100%</p>
              <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Siap Produksi &amp; Cetak</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-amber-500">Mendukung</p>
              <p className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wider">Kurikulum Merdeka &amp; K13</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FITUR UTAMA SECTION */}
      <section id="fitur" className="py-20 bg-white border-y border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Satu Dasbor Pintar, Segudang Manfaat Menanti</h2>
            <p className="mt-3 text-slate-500 text-sm md:text-base leading-relaxed">Dirancang khusus untuk menyesuaikan beban kerja guru agar fokus mengajar tidak terpecah oleh urusan administrasi kertas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feat: any, idx: number) => (
              <div key={idx} className="p-8 border border-slate-100 rounded-3xl bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-slate-200 transition duration-300">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shadow-inner">{feat.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mt-5">{feat.title}</h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PENAWARAN BERLANGGANAN (PRICING) */}
      <section id="harga" className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mb-4">
              🏷️ Rencana Langganan Fleksibel
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Investasi Terbaik untuk Efisiensi Anda
            </h2>
            <p className="mt-4 text-slate-500 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Pilih paket yang paling pas untuk kebutuhan mengajar Anda. Seluruh paket didesain khusus untuk mendukung tugas administrasi guru Indonesia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            
            {/* Paket 1: Free */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-slate-300 transition duration-300 relative group">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-slate-900 font-black text-xl tracking-tight">Free</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Uji coba awal fitur GuruPRO</p>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-base shadow-inner">🌱</span>
                </div>
                
                <div className="mt-5 flex items-baseline text-slate-900">
                  <span className="text-2xl font-black">Rp</span>
                  <span className="text-4xl font-extrabold tracking-tight">0</span>
                  <span className="text-slate-400 text-xs font-semibold ml-1">/ {pricing.free.duration_days} hari</span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Tanpa biaya, coba langsung gratis</p>
                
                <div className="w-full h-px bg-slate-100 my-5" />
                
                <ul className="space-y-3 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span><strong>{pricing.free.tokens} Token</strong> Kuota Sekali</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Masa Aktif {pricing.free.duration_days} Hari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Generator Soal (LOTS C1-C3)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Dukungan Kurikulum Merdeka</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-400/80 line-through decoration-slate-300">
                    <span>✗</span> 
                    <span>Generator Soal HOTS (C4-C6)</span>
                  </li>
                </ul>
              </div>
              
              <Link 
                href={isLoggedIn ? "/dashboard?checkout=free" : (refCode ? `/login?checkout=free&ref=${refCode}` : "/login?checkout=free")} 
                className="w-full py-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-center font-bold text-xs rounded-2xl text-slate-700 mt-6 transition duration-200 block"
              >
                Coba Gratis
              </Link>
            </div>

            {/* Paket 2: 3 Bulan */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-slate-300 transition duration-300 relative group">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-slate-900 font-black text-xl tracking-tight">3 Bulan</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Pendamping mengajar 1 triwulan</p>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-base shadow-inner">⚡</span>
                </div>
                
                <div className="mt-5 flex items-baseline text-slate-900">
                  <span className="text-2xl font-black">Rp</span>
                  <span className="text-4xl font-extrabold tracking-tight">{formatPrice(pricing.three_month.price)}</span>
                  <span className="text-slate-400 text-xs font-semibold ml-1">/ paket</span>
                </div>
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                  Setara Rp {formatPrice(Math.round(pricing.three_month.price / 3))}/bulan
                </p>
                
                <div className="w-full h-px bg-slate-100 my-5" />
                
                <ul className="space-y-3 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span><strong>{pricing.three_month.tokens} Token</strong> Kuota Utama</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Masa Aktif {pricing.three_month.duration_days} Hari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Generator Soal HOTS (C4-C6)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Cetak Lembar Jawaban Resmi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Server Prioritas & CS Terpadu</span>
                  </li>
                </ul>
              </div>
              
              <Link 
                href={isLoggedIn ? "/dashboard?checkout=three_month" : (refCode ? `/login?checkout=three_month&ref=${refCode}` : "/login?checkout=three_month")} 
                className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-center font-bold text-xs rounded-2xl mt-6 transition duration-200 block"
              >
                Pilih Paket
              </Link>
            </div>

            {/* Paket 3: 6 Bulan */}
            <div className="bg-white border-2 border-indigo-600 rounded-3xl p-6 flex flex-col justify-between shadow-lg shadow-indigo-100 hover:shadow-2xl transition duration-300 relative transform md:-translate-y-2">
              <span className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md animate-bounce">
                Paling Populer 🔥
              </span>
              
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-slate-900 font-black text-xl tracking-tight">6 Bulan</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Persiapan matang untuk 2 semester</p>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-base shadow-inner">⭐</span>
                </div>
                
                <div className="mt-5 flex items-baseline text-slate-900">
                  <span className="text-2xl font-black">Rp</span>
                  <span className="text-4xl font-extrabold tracking-tight">{formatPrice(pricing.six_month.price)}</span>
                  <span className="text-slate-400 text-xs font-semibold ml-1">/ paket</span>
                </div>
                <p className="text-[10px] text-indigo-600 font-bold mt-1">
                  Setara Rp {formatPrice(Math.round(pricing.six_month.price / 6))}/bulan
                </p>
                
                <div className="w-full h-px bg-slate-100 my-5" />
                
                <ul className="space-y-3 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="text-indigo-600">★</span> 
                    <span><strong>{pricing.six_month.tokens} Token</strong> Kuota Utama</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Masa Aktif {pricing.six_month.duration_days} Hari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Generator Soal HOTS (C4-C6)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Cetak Lembar Jawaban Resmi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Server Prioritas & CS Prioritas</span>
                  </li>
                </ul>
              </div>
              
              <Link 
                href={isLoggedIn ? "/dashboard?checkout=six_month" : (refCode ? `/login?checkout=six_month&ref=${refCode}` : "/login?checkout=six_month")} 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-center font-bold text-xs rounded-2xl mt-6 shadow-sm hover:shadow-md transition duration-200 block"
              >
                Beli Sekarang
              </Link>
            </div>

            {/* Paket 4: 1 Tahun */}
            <div className="bg-white border border-amber-300 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-amber-400 transition duration-300 relative group">
              <span className="absolute top-0 right-6 -translate-y-1/2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                Nilai Terbaik 🏆
              </span>
              
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-slate-900 font-black text-xl tracking-tight">1 Tahun</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Efisiensi maksimal jangka panjang</p>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-base shadow-inner">👑</span>
                </div>
                
                <div className="mt-5 flex items-baseline text-slate-900">
                  <span className="text-2xl font-black">Rp</span>
                  <span className="text-4xl font-extrabold tracking-tight">{formatPrice(pricing.one_year.price)}</span>
                  <span className="text-slate-400 text-xs font-semibold ml-1">/ paket</span>
                </div>
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  Setara Rp {formatPrice(Math.round(pricing.one_year.price / 12))}/bulan
                </p>
                
                <div className="w-full h-px bg-slate-100 my-5" />
                
                <ul className="space-y-3 text-xs font-medium text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="text-amber-500">★</span> 
                    <span><strong>{pricing.one_year.tokens} Token</strong> Kuota Utama</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Masa Aktif {pricing.one_year.duration_days} Hari</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Generator Soal HOTS (C4-C6)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>Cetak Lembar Jawaban Resmi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> 
                    <span>CS VIP 24/7 & Backup Riwayat</span>
                  </li>
                </ul>
              </div>
              
              <Link 
                href={isLoggedIn ? "/dashboard?checkout=one_year" : (refCode ? `/login?checkout=one_year&ref=${refCode}` : "/login?checkout=one_year")} 
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-center font-bold text-xs rounded-2xl mt-6 shadow-sm hover:shadow-md transition duration-200 block"
              >
                Pilih Paket
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 5. REFERRAL / CASHBACK MARKETING SECTION */}
      <section id="referral" className="py-20 bg-gradient-to-br from-indigo-900 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full inline-block mb-6">
            🎁 Program Kemitraan Guru
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Bagikan GuruPro, Dapatkan Cashback &amp; Token!
          </h2>
          <p className="mt-6 text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {referralTerms}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 max-w-lg mx-auto text-left">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-xl">💰</span>
              <h4 className="font-bold text-xs mt-2 uppercase tracking-wider text-indigo-300">Cashback Saldo Dompet</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Saldo cashback sebesar Rp10.000 ditambahkan ke dompet akun Anda setiap kali teman Anda meng-upgrade status akun menjadi PRO. Saldo ini dapat dicairkan langsung ke rekening bank.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-xl">⚡</span>
              <h4 className="font-bold text-xs mt-2 uppercase tracking-wider text-indigo-300">Token Kuota Tambahan</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Dapatkan +20 Token kuota ekstra gratis untuk generator soal Anda, sementara teman Anda mendapatkan +10 Token kuota tambahan saat mendaftar!
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link 
              href={isLoggedIn ? "/dashboard" : (refCode ? `/login?ref=${refCode}` : "/login?mode=register")} 
              className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-lg transition duration-200"
            >
              Mulai Undang Teman
            </Link>
          </div>
        </div>
      </section>

      {/* 6. FAQ SECTION */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Pertanyaan yang Sering Diajukan</h2>
            <p className="mt-2 text-slate-500 text-sm">Masih ragu mengenai GuruPRO? Berikut rincian jawabannya.</p>
          </div>

          <div className="space-y-6">
            {faq.map((item: any, idx: number) => (
              <div key={idx} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <h4 className="font-bold text-sm text-slate-900">{item.question}</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center text-xs border-t border-slate-800 space-y-4">
        <div>
          <p className="font-bold text-white mb-2">{cmsConfig?.footer_copyright || "GuruPRO Ecosystem © 2026"}</p>
          <p>{cmsConfig?.footer_desc || "Solusi Cerdas Pendidikan Efektif Digital Modern."}</p>
        </div>
        
        {/* Dynamic CMS Links */}
        <div className="flex justify-center gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span className="hover:text-white transition cursor-pointer">{cmsConfig?.footer_terms || "Terms & Conditions"}</span>
          <span className="hover:text-white transition cursor-pointer">{cmsConfig?.footer_privacy || "Privacy Policy"}</span>
          <span className="hover:text-white transition cursor-pointer">{cmsConfig?.footer_contact || "Hubungi Kami"}</span>
        </div>
      </footer>

      {/* AI CUSTOMER SERVICE CHATBOT WIDGET */}
      <div className="fixed bottom-6 right-6 z-50 font-sans">
        {/* Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center text-2xl shadow-xl transition-transform duration-300 hover:scale-110 cursor-pointer focus:outline-none"
          title={`Tanya Asisten AI ${brandingConfig?.app_name || "GuruPRO"}`}
        >
          {isChatOpen ? "✕" : "🤖"}
        </button>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="fixed bottom-24 right-6 w-[320px] sm:w-[360px] h-[400px] bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden flex flex-col transition-all duration-300 animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div className="text-left">
                  <h4 className="text-xs font-black tracking-wide leading-none">Asisten AI {brandingConfig?.app_name || "GuruPRO"}</h4>
                  <span className="text-[9px] text-indigo-200 font-bold mt-1 block">Customer Support Online</span>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed shadow-sm font-medium text-left ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200/85 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-slate-400 border border-slate-200/60 rounded-2xl rounded-tl-none px-3.5 py-2 text-[10px] italic font-semibold flex items-center gap-1 shadow-sm">
                    <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={sendChatMessage} className="p-3 border-t border-slate-200 bg-white flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tanyakan sesuatu..."
                disabled={isChatLoading}
                className="flex-1 px-3.5 py-2 border border-slate-200 rounded-2xl text-[11px] focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-medium"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-bold transition disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-100"
              >
                Kirim
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}