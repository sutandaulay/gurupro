import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use getSession which checks both gurupro_session cookie AND NextAuth session
  // This ensures both manual login and Google OAuth users can access admin
  const session = await getSession();

  if (!session || !['admin', 'super_admin', 'manager'].includes(session.role)) {
    redirect('/login'); // Redirect ke login jika bukan admin
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}