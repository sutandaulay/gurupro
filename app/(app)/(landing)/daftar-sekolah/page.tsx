'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, FormEvent } from 'react';
import Link from 'next/link';

const JENJANG_OPTIONS = [
  'PAUD/TK',
  'SD/MI',
  'SMP/MTs',
  'SMA/MA',
  'SMK',
  'SLB',
  'Pesantren',
  'Lainnya',
];

const NAUNGAN_OPTIONS = [
  'Kemenag (Kementerian Agama)',
  'Kemendikbud (Kementerian Pendidikan)',
  'Swasta / Yayasan',
  'Lainnya',
];

interface FormData {
  nama_lembaga: string;
  npsn: string;
  jenjang: string;
  naungan: string;
  alamat: string;
  nama_kepala_sekolah: string;
  email_kontak: string;
  whatsapp: string;
}

export default function DaftarSekolahPage() {
  const [form, setForm] = useState<FormData>({
    nama_lembaga: '',
    npsn: '',
    jenjang: '',
    naungan: '',
    alamat: '',
    nama_kepala_sekolah: '',
    email_kontak: '',
    whatsapp: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/public/school-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Tampilan sukses
  if (success) {
    return (
      <div className="daftar-sekolah-page">
        <style>{pageStyles}</style>
        <div className="ds-container">
          <div className="ds-success-card">
            <div className="ds-success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Pendaftaran Berhasil! 🎉</h2>
            <p>
              Terima kasih telah mendaftarkan lembaga Anda di <strong>GuruPRO</strong>.
              Tim kami akan meninjau dan menghubungi Anda melalui email atau WhatsApp
              dalam <strong>1–3 hari kerja</strong>.
            </p>
            <Link href="/" className="ds-btn ds-btn-back">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="daftar-sekolah-page">
      <style>{pageStyles}</style>
      <div className="ds-container">
        {/* Header */}
        <div className="ds-header">
          <Link href="/" className="ds-back-link">← Kembali</Link>
          <div className="ds-badge">📋 Pendaftaran Lembaga</div>
          <h1>Daftarkan Sekolah / Lembaga Anda</h1>
          <p className="ds-subtitle">
            Bergabunglah bersama ribuan sekolah yang telah menggunakan GuruPRO
            untuk mengelola administrasi pendidikan secara digital.
          </p>
        </div>

        {/* Form */}
        <form className="ds-form" onSubmit={handleSubmit}>
          {error && (
            <div className="ds-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="ds-section">
            <h3>📌 Data Lembaga</h3>
            <div className="ds-grid">
              <div className="ds-field ds-full">
                <label htmlFor="nama_lembaga">
                  Nama Sekolah / Lembaga <span className="ds-required">*</span>
                </label>
                <input
                  id="nama_lembaga"
                  name="nama_lembaga"
                  type="text"
                  placeholder="contoh: SMP Negeri 1 Jakarta"
                  value={form.nama_lembaga}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ds-field">
                <label htmlFor="npsn">NPSN</label>
                <input
                  id="npsn"
                  name="npsn"
                  type="text"
                  placeholder="Nomor Pokok Sekolah Nasional"
                  value={form.npsn}
                  onChange={handleChange}
                />
              </div>

              <div className="ds-field">
                <label htmlFor="jenjang">
                  Jenjang <span className="ds-required">*</span>
                </label>
                <select
                  id="jenjang"
                  name="jenjang"
                  value={form.jenjang}
                  onChange={handleChange}
                  required
                >
                  <option value="">— Pilih Jenjang —</option>
                  {JENJANG_OPTIONS.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              <div className="ds-field">
                <label htmlFor="naungan">
                  Naungan <span className="ds-required">*</span>
                </label>
                <select
                  id="naungan"
                  name="naungan"
                  value={form.naungan}
                  onChange={handleChange}
                  required
                >
                  <option value="">— Pilih Naungan —</option>
                  {NAUNGAN_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="ds-field ds-full">
                <label htmlFor="alamat">Alamat Sekolah</label>
                <textarea
                  id="alamat"
                  name="alamat"
                  placeholder="Jl. Pendidikan No. 123, Kota, Provinsi"
                  value={form.alamat}
                  onChange={handleChange}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="ds-section">
            <h3>👤 Data Kontak</h3>
            <div className="ds-grid">
              <div className="ds-field">
                <label htmlFor="nama_kepala_sekolah">Nama Kepala Sekolah</label>
                <input
                  id="nama_kepala_sekolah"
                  name="nama_kepala_sekolah"
                  type="text"
                  placeholder="Nama lengkap"
                  value={form.nama_kepala_sekolah}
                  onChange={handleChange}
                />
              </div>

              <div className="ds-field">
                <label htmlFor="email_kontak">
                  Email Kontak <span className="ds-required">*</span>
                </label>
                <input
                  id="email_kontak"
                  name="email_kontak"
                  type="email"
                  placeholder="email@sekolah.sch.id"
                  value={form.email_kontak}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ds-field">
                <label htmlFor="whatsapp">Nomor WhatsApp</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={form.whatsapp}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="ds-btn ds-btn-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="ds-spinner" /> Mengirim...
              </>
            ) : (
              '🚀 Kirim Pendaftaran'
            )}
          </button>

          <p className="ds-note">
            Dengan mengirim formulir ini, Anda menyetujui{' '}
            <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link> dan{' '}
            <Link href="/kebijakan-privasi">Kebijakan Privasi</Link> GuruPRO.
          </p>
        </form>
      </div>
    </div>
  );
}

const pageStyles = `
  .daftar-sekolah-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f0c29 0%, #1a1145 40%, #302b63 70%, #24243e 100%);
    padding: 2rem 1rem 4rem;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: #e2e8f0;
  }

  .ds-container {
    max-width: 680px;
    margin: 0 auto;
  }

  /* Header */
  .ds-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .ds-back-link {
    display: inline-block;
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    transition: color 0.2s;
  }
  .ds-back-link:hover { color: #c4b5fd; }

  .ds-badge {
    display: inline-block;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    padding: 0.35rem 1rem;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .ds-header h1 {
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, #c4b5fd, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.75rem;
    line-height: 1.2;
  }

  .ds-subtitle {
    color: #94a3b8;
    font-size: 1rem;
    line-height: 1.6;
    max-width: 540px;
    margin: 0 auto;
  }

  /* Form */
  .ds-form {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2rem;
  }

  .ds-error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 0.85rem 1.1rem;
    border-radius: 12px;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ds-section {
    margin-bottom: 1.75rem;
  }

  .ds-section h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #c4b5fd;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
  }

  .ds-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .ds-full { grid-column: 1 / -1; }

  .ds-field label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: 0.35rem;
  }

  .ds-required { color: #f87171; }

  .ds-field input,
  .ds-field select,
  .ds-field textarea {
    width: 100%;
    padding: 0.7rem 0.9rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 0.95rem;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
    box-sizing: border-box;
  }

  .ds-field input::placeholder,
  .ds-field textarea::placeholder {
    color: #64748b;
  }

  .ds-field input:focus,
  .ds-field select:focus,
  .ds-field textarea:focus {
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }

  .ds-field select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.9rem center;
    padding-right: 2.5rem;
    cursor: pointer;
  }

  .ds-field select option {
    background: #1e1b4b;
    color: #e2e8f0;
  }

  .ds-field textarea {
    resize: vertical;
    min-height: 60px;
  }

  /* Submit */
  .ds-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: inherit;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.25s ease;
    text-decoration: none;
  }

  .ds-btn-submit {
    width: 100%;
    padding: 0.9rem;
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    color: #fff;
    margin-top: 0.5rem;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
  }
  .ds-btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(124, 58, 237, 0.45);
  }
  .ds-btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ds-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ds-spin 0.7s linear infinite;
  }

  @keyframes ds-spin {
    to { transform: rotate(360deg); }
  }

  .ds-note {
    text-align: center;
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 1rem;
  }
  .ds-note a {
    color: #a5b4fc;
    text-decoration: underline;
  }

  /* Success */
  .ds-success-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 3rem 2rem;
    text-align: center;
    margin-top: 4rem;
    animation: ds-fadeUp 0.5s ease-out;
  }

  @keyframes ds-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ds-success-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 1.5rem;
    background: rgba(52, 211, 153, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #34d399;
  }
  .ds-success-icon svg { width: 36px; height: 36px; }

  .ds-success-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 1rem;
  }

  .ds-success-card p {
    color: #94a3b8;
    font-size: 1rem;
    line-height: 1.7;
    margin: 0 0 2rem;
  }

  .ds-btn-back {
    padding: 0.75rem 1.5rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
  }
  .ds-btn-back:hover {
    background: rgba(139, 92, 246, 0.25);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .ds-header h1 { font-size: 1.5rem; }
    .ds-grid { grid-template-columns: 1fr; }
    .ds-form { padding: 1.25rem; }
    .ds-success-card { padding: 2rem 1.25rem; margin-top: 2rem; }
  }
`;
