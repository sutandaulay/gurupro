import Link from "next/link";
import Footer from "@/components/landing/Footer";

export interface LegalPageData {
  title: string;
  content: string;
  last_updated?: string;
}

export default function LegalPage({
  data,
  defaultContent = "",
}: {
  data: LegalPageData | null;
  defaultContent?: string;
}) {
  const title = data?.title || "";
  const content = data?.content || defaultContent;
  const updated = data?.last_updated;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-primary-600 font-black text-sm hover:text-primary-700">
            ← Kembali ke Beranda
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12">
          {title && (
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">{title}</h1>
          )}
          {updated && (
            <p className="text-xs text-slate-400 mb-8">Terakhir diperbarui: {updated}</p>
          )}
          <div
            className="prose prose-sm md:prose-base max-w-none prose-slate prose-headings:text-slate-900 prose-headings:font-bold prose-a:text-primary-600 prose-strong:text-slate-800"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>
      </main>

      <Footer
        description="GuruPRO AI — Platform Administrasi Guru Berbasis AI untuk Indonesia."
        copyright={`GuruPRO AI © ${new Date().getFullYear()}`}
      />
    </div>
  );
}