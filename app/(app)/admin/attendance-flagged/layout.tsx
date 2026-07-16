import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AdminAttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use getSession which checks both gurupro_session cookie AND NextAuth session
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    redirect('/login'); // Redirect ke login jika bukan admin
  }

  return <>{children}</>;
}