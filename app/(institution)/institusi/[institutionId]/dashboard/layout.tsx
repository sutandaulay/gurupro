import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import InstitutionShell from "@/app/components/institution/InstitutionShell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ institutionId: string }>;
}

async function getInstitutionInfo(institutionId: number) {
  try {
    const result = await query(
      `SELECT id, name, npsn, jenjang, naungan, subscription_tier, academic_year_active, status
       FROM institutions WHERE id = $1`,
      [institutionId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch {
    return null;
  }
}

async function getUserRoles(
  appUserId: string,
  institutionId: number
): Promise<string[]> {
  try {
    const result = await query(
      `SELECT imr.value
       FROM institution_members im
       JOIN institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [appUserId, institutionId]
    );
    return result.rows.map((r: { value: string }) => r.value);
  } catch {
    return [];
  }
}

export default async function InstitutionDashboardLayout({
  children,
  params,
}: Props) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);
  if (isNaN(instId)) redirect("/dashboard");

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const inst = await getInstitutionInfo(instId);
  if (!inst) redirect("/dashboard");

  if (inst.status !== "active") {
    redirect(`/institusi/${instId}/langganan-tidak-aktif`);
  }

  const roles = await getUserRoles(session.id, instId);
  const allowed = roles.some(
    (r) => r === "kepala_sekolah" || r === "operator"
  );
  if (!allowed) redirect("/dashboard");

  return (
    <InstitutionShell
      institutionId={instId}
      institutionName={inst.name}
      userRoles={roles}
    >
      {children}
    </InstitutionShell>
  );
}
