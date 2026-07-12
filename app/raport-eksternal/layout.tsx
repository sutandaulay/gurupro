import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Akses Raport Eksternal - GuruPRO AI",
  description: "Akses data raport dari GuruPRO AI",
};

export default function RaportEksternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
