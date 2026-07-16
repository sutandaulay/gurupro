import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan Presensi & Kinerja - GuruPRO AI",
  description: "Laporan kehadiran dan kinerja mengajar mingguan dari GuruPRO AI",
};

export default function AttendancePerformanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}