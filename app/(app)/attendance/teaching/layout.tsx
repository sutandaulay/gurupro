import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function TeachingAttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use getSession which checks both gurupro_session cookie AND NextAuth session
  const session = await getSession();

  if (!session) {
    redirect('/login'); // Redirect ke login jika belum login
  }

  // Hanya guru yang bisa mengakses halaman ini
  // Note: role can be 'teacher' or 'guru' (both are valid)
  if (session.role !== 'teacher' && session.role !== 'guru' && session.role !== 'admin') {
    redirect('/dashboard'); // Redirect ke dashboard jika bukan guru
  }

  return <>{children}</>;
}