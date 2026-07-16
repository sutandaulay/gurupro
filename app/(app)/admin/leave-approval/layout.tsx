import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function LeaveApprovalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use getSession which checks both gurupro_session cookie AND NextAuth session
  const session = await getSession();

  if (!session) {
    redirect('/login'); // Redirect ke login jika belum login
  }

  // Hanya admin, operator, kepala sekolah, atau wakasek yang bisa mengakses halaman ini
  const allowedRoles = ['admin', 'operator', 'kepala_sekolah', 'wakasek'];
  if (!allowedRoles.includes(session.role)) {
    redirect('/dashboard'); // Redirect ke dashboard jika tidak memiliki peran yang sesuai
  }

  return <>{children}</>;
}