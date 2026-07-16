import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AttendanceReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use getSession which checks both gurupro_session cookie AND NextAuth session
  const session = await getSession();

  if (!session) {
    redirect('/login'); // Redirect ke login jika belum login
  }

  // Hanya pengguna dengan peran tertentu yang bisa mengakses laporan
  // Guru bisa melihat laporan miliknya sendiri
  // Kepala Sekolah/Wakasek/Operator bisa melihat laporan di institusinya
  // Admin bisa melihat semua laporan
  const allowedRoles = ['admin', 'kepala_sekolah', 'wakasek', 'operator', 'teacher', 'guru'];
  if (!allowedRoles.includes(session.role)) {
    redirect('/dashboard'); // Redirect ke dashboard jika tidak memiliki peran yang sesuai
  }

  return <>{children}</>;
}